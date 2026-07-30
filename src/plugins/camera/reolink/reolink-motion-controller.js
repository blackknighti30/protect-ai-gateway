'use strict';

const DEFAULT_POLL_INTERVAL_MS = 1000;
const MIN_POLL_INTERVAL_MS = 250;

function normalizeMotionState(value) {
    if (value && typeof value === 'object') {
        if (Object.prototype.hasOwnProperty.call(value, 'state'))
            return normalizeMotionState(value.state);
        if (Object.prototype.hasOwnProperty.call(value, 'State'))
            return normalizeMotionState(value.State);
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['1', 'true', 'on', 'motion'].includes(normalized)) return true;
        if (['0', 'false', 'off', 'none'].includes(normalized)) return false;
    }
    return value === true || value === 1;
}

class ReolinkMotionController {
    constructor(logger, client, config = {}, dependencies = {}) {
        this.logger = logger;
        this.client = client;
        this.channel = Number(config.channel || 0);
        this.sourceToken = String((config.events && config.events.sourceToken) ||
            config.sourceToken || 'video_source');
        const configuredInterval = Number(config.events && config.events.pollIntervalMs);
        this.pollIntervalMs = Number.isFinite(configuredInterval)
            ? Math.max(MIN_POLL_INTERVAL_MS, configuredInterval)
            : DEFAULT_POLL_INTERVAL_MS;
        this.setInterval = dependencies.setInterval || global.setInterval;
        this.clearInterval = dependencies.clearInterval || global.clearInterval;
        this.timer = null;
        this.running = false;
        this.polling = false;
        this.lastState = undefined;
        this.publish = null;
    }

    async poll() {
        if (!this.running || this.polling) return;
        this.polling = true;
        try {
            const state = normalizeMotionState(await this.client.getMotionState(this.channel));
            if (state !== this.lastState) {
                const previous = this.lastState;
                this.lastState = state;
                if (previous !== undefined && this.publish)
                    this.publish({ objectType: 'motion', state, sourceToken: this.sourceToken });
            }
        } catch (error) {
            this.logger.error(`Reolink motion poll failed: ${error.message}`);
        } finally {
            this.polling = false;
        }
    }

    start(publish) {
        if (this.running) return;
        if (typeof publish !== 'function')
            throw new TypeError('Motion event publisher must be a function');
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

module.exports = ReolinkMotionController;
module.exports.normalizeMotionState = normalizeMotionState;
