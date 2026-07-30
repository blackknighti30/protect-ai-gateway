'use strict';

const {
    STATES,
    normalizeDetection
} = require('../detections/detection');
const { validateOutputPlugin } = require('../plugins/output/output-plugin');

function detectionKey(detection) {
    return `${detection.cameraId}\u0000${detection.trackerId}`;
}

function stableValue(value) {
    if (Array.isArray(value))
        return value.map(stableValue);

    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.keys(value)
                .sort()
                .map(key => [key, stableValue(value[key])])
        );
    }

    return value;
}

function updateFingerprint(detection) {
    return JSON.stringify(stableValue({
        type: detection.type,
        confidence: detection.confidence,
        boundingBox: detection.boundingBox,
        stationary: detection.stationary,
        zones: detection.zones,
        attributes: detection.attributes
    }));
}

function cloneDetection(detection) {
    return {
        ...detection,
        zones: [...detection.zones],
        attributes: { ...detection.attributes }
    };
}

class GatewayEventEngine {
    constructor(options = {}) {
        this.logger = options.logger || null;
        this.outputs = new Map();
        this.active = new Map();
        this.metrics = {
            detectionsReceived: 0,
            detectionsDispatched: 0,
            duplicatesSuppressed: 0,
            outputFailures: 0
        };
    }

    registerOutput(id, output) {
        const validated = validateOutputPlugin(id, output);
        if (this.outputs.has(validated.id))
            throw new Error(`output is already registered: ${validated.id}`);

        this.outputs.set(validated.id, validated.output);
        return validated.id;
    }

    unregisterOutput(id) {
        return this.outputs.delete(id);
    }

    async accept(input) {
        this.metrics.detectionsReceived += 1;

        const received = normalizeDetection(input);
        if (!received.cameraId)
            throw new TypeError('detection cameraId must be a non-empty string');
        if (!received.trackerId)
            throw new TypeError('detection trackerId must be a non-empty string');

        const key = detectionKey(received);
        const previous = this.active.get(key);
        const detection = this.#normalizeTransition(received, previous);

        if (!detection) {
            this.metrics.duplicatesSuppressed += 1;
            return Object.freeze({
                accepted: false,
                reason: 'duplicate',
                detection: null,
                deliveries: Object.freeze([])
            });
        }

        if (detection.state === STATES.LEAVE)
            this.active.delete(key);
        else
            this.active.set(key, detection);

        const deliveries = await this.#dispatch(detection);
        this.metrics.detectionsDispatched += 1;

        return Object.freeze({
            accepted: true,
            reason: null,
            detection,
            deliveries: Object.freeze(deliveries)
        });
    }

    getActiveDetections() {
        return [...this.active.values()]
            .map(cloneDetection)
            .sort((left, right) => {
                const camera = left.cameraId.localeCompare(right.cameraId);
                return camera || left.trackerId.localeCompare(right.trackerId);
            });
    }

    getMetrics() {
        return Object.freeze({
            ...this.metrics,
            activeObjects: this.active.size,
            registeredOutputs: this.outputs.size
        });
    }

    #normalizeTransition(received, previous) {
        if (received.state === STATES.LEAVE) {
            if (!previous)
                return null;

            return Object.freeze({
                ...received,
                type: received.type === 'unknown' ? previous.type : received.type,
                firstSeenTimestamp: previous.firstSeenTimestamp,
                boundingBox: received.boundingBox || previous.boundingBox,
                zones: received.zones.length > 0 ? received.zones : previous.zones,
                attributes: {
                    ...previous.attributes,
                    ...received.attributes
                }
            });
        }

        const state = previous ? STATES.UPDATE : STATES.ENTER;
        const firstSeenTimestamp = previous
            ? previous.firstSeenTimestamp
            : (received.firstSeenTimestamp ?? received.timestamp);

        const normalized = Object.freeze({
            ...received,
            state,
            firstSeenTimestamp
        });

        if (previous &&
            updateFingerprint(previous) === updateFingerprint(normalized)) {
            return null;
        }

        return normalized;
    }

    async #dispatch(detection) {
        const deliveries = await Promise.all(
            [...this.outputs.entries()].map(async ([id, output]) => {
                try {
                    await output.onDetection(detection);
                    return Object.freeze({ id, delivered: true, error: null });
                } catch (error) {
                    this.metrics.outputFailures += 1;
                    this.#logOutputFailure(id, error);
                    return Object.freeze({ id, delivered: false, error });
                }
            })
        );

        return deliveries;
    }

    #logOutputFailure(id, error) {
        if (!this.logger)
            return;

        const details = { outputId: id, error };
        if (typeof this.logger.error === 'function')
            this.logger.error('gateway output failed to process detection', details);
        else if (typeof this.logger === 'function')
            this.logger('gateway output failed to process detection', details);
    }
}

module.exports = GatewayEventEngine;
