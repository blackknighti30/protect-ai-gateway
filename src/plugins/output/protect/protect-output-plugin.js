'use strict';

const { buildProtectDetectionEnvelope } = require('./protect-event-mapper');

class ProtectOutputPlugin {
    constructor(context, config = {}, dependencies = {}) {
        if (!context || typeof context !== 'object')
            throw new TypeError('Protect output plugin requires an output context');

        const transport = dependencies.transport || context.services.transport;
        if (!transport || typeof transport.send !== 'function') {
            throw new TypeError(
                'Protect output plugin requires a transport with send(envelope)'
            );
        }

        this.context = context;
        this.config = config;
        this.transport = transport;
        this.clock = dependencies.clock || Date;
        this.logger = dependencies.logger || context.logger || {
            debug() {}, info() {}, error() {}
        };
        this.nextEventId = Number.isSafeInteger(config.initialEventId)
            ? config.initialEventId
            : 1;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        if (typeof this.transport.connect === 'function')
            await this.transport.connect();
        this.initialized = true;
    }

    async onDetection(detection) {
        const eventId = this.nextEventId++;
        const now = this.clock.now();
        const envelope = buildProtectDetectionEnvelope(detection, {
            eventId,
            deviceId: this.config.deviceId,
            connectionId: this.config.connectionId,
            macAddress: this.config.macAddress,
            displayTimeoutMs: this.config.displayTimeoutMs,
            clockMonotonic: now,
            clockStream: now,
            clockStreamRate: 1000,
            offsetMs: this.config.offsetMs
        });

        await this.transport.send(envelope);
        this.logger.debug?.('Published Protect Smart Detect event', {
            eventId,
            cameraId: envelope.payload.deviceID,
            trackerId: detection.trackerId,
            state: detection.state,
            type: detection.type
        });

        return { eventId, envelope };
    }

    async onSnapshot(snapshot) {
        if (typeof this.transport.sendSnapshot !== 'function')
            return false;
        await this.transport.sendSnapshot(snapshot);
        return true;
    }

    async shutdown() {
        if (!this.initialized) return;
        this.initialized = false;
        if (typeof this.transport.close === 'function')
            await this.transport.close();
    }
}

module.exports = ProtectOutputPlugin;
