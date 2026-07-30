'use strict';

const DEFAULT_POLL_INTERVAL_MS = 1000;
const MIN_POLL_INTERVAL_MS = 250;
const DETECTIONS = Object.freeze([
    { objectType: 'person', keys: ['people', 'person', 'human'] },
    { objectType: 'vehicle', keys: ['vehicle', 'car'] },
    { objectType: 'pet', keys: ['dog_cat', 'dogCat', 'pet', 'animal'] }
]);

function normalizeAlarmState(value) {
    if (value && typeof value === 'object') {
        for (const key of ['alarm_state', 'alarmState', 'state', 'State', 'detected']) {
            if (Object.prototype.hasOwnProperty.call(value, key))
                return normalizeAlarmState(value[key]);
        }
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['1', 'true', 'on', 'active', 'detected'].includes(normalized)) return true;
        if (['0', 'false', 'off', 'inactive', 'none'].includes(normalized)) return false;
    }
    return value === true || value === 1;
}

function findDetectionState(payload, keys) {
    if (!payload || typeof payload !== 'object') return false;
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(payload, key))
            return normalizeAlarmState(payload[key]);
    }
    return false;
}

function normalizeAiState(payload) {
    const source = payload && typeof payload === 'object' && payload.AiState
        ? payload.AiState : payload;
    return Object.fromEntries(DETECTIONS.map(({ objectType, keys }) => [
        objectType,
        findDetectionState(source, keys)
    ]));
}

class ReolinkAnalyticsController {
    constructor(logger, client, config = {}, dependencies = {}) {
        this.logger = logger;
        this.client = client;
        this.channel = Number(config.channel || 0);
        this.sourceToken = String((config.events && config.events.sourceToken) ||
            config.sourceToken || 'video_source');
        const configuredInterval = Number(config.events && config.events.aiPollIntervalMs);
        this.pollIntervalMs = Number.isFinite(configuredInterval)
            ? Math.max(MIN_POLL_INTERVAL_MS, configuredInterval)
            : DEFAULT_POLL_INTERVAL_MS;
        this.enabled = !(config.events && config.events.aiEnabled === false);
        this.setInterval = dependencies.setInterval || global.setInterval;
        this.clearInterval = dependencies.clearInterval || global.clearInterval;
        this.timer = null;
        this.running = false;
        this.polling = false;
        this.lastState = null;
        this.publish = null;
    }

    async poll() {
        if (!this.running || this.polling) return;
        this.polling = true;
        try {
            const state = normalizeAiState(await this.client.getAiState(this.channel));
            if (this.lastState) {
                for (const { objectType } of DETECTIONS) {
                    if (state[objectType] !== this.lastState[objectType]) {
                        this.publish({ objectType, state: state[objectType], sourceToken: this.sourceToken });
                    }
                }
            }
            this.lastState = state;
        } catch (error) {
            this.logger.error(`Reolink AI poll failed: ${error.message}`);
        } finally {
            this.polling = false;
        }
    }

    start(publish) {
        if (!this.enabled || this.running) return;
        if (typeof publish !== 'function')
            throw new TypeError('Analytics event publisher must be a function');
        this.publish = publish;
        this.running = true;
        void this.poll();
        this.timer = this.setInterval(() => void this.poll(), this.pollIntervalMs);
        if (this.timer && typeof this.timer.unref === 'function') this.timer.unref();
    }

    close() {
        this.running = false;
        if (this.timer) {
            this.clearInterval(this.timer);
            this.timer = null;
        }
        this.publish = null;
        return Promise.resolve();
    }
}

module.exports = ReolinkAnalyticsController;
module.exports.normalizeAlarmState = normalizeAlarmState;
module.exports.normalizeAiState = normalizeAiState;
