'use strict';

const ReolinkClient = require('./reolink-client');
const ReolinkMotionController = require('./reolink-motion-controller');
const ReolinkAnalyticsController = require('./reolink-analytics-controller');

class ReolinkCameraPlugin {
    constructor(context, config = {}, dependencies = {}) {
        if (!context || typeof context.publishDetection !== 'function')
            throw new TypeError('Reolink camera plugin requires a camera context');

        this.context = context;
        this.config = config;
        this.logger = dependencies.logger || context.logger || {
            debug() {}, info() {}, error() {}
        };
        this.clock = dependencies.clock || Date;
        this.client = dependencies.client || new ReolinkClient(this.logger, config);
        this.motion = dependencies.motion || new ReolinkMotionController(
            this.logger, this.client, config, dependencies
        );
        this.analytics = dependencies.analytics || new ReolinkAnalyticsController(
            this.logger, this.client, config, dependencies
        );
        this.running = false;
    }

    async initialize() {
        await this.client.login();
    }

    async start() {
        if (this.running) return;
        const publish = transition => this.publishTransition(transition);
        this.motion.start(publish);
        this.analytics.start(publish);
        this.running = true;
    }

    async stop() {
        if (!this.running) return;
        this.running = false;
        await Promise.all([this.motion.close(), this.analytics.close()]);
    }

    async getSnapshot() {
        return this.client.getSnapshot();
    }

    getCapabilities() {
        return {
            detections: true,
            snapshots: true,
            ptz: false,
            pan: false,
            tilt: false,
            zoom: false,
            presets: false,
            audio: false,
            objectTypes: ['motion', 'person', 'vehicle', 'pet'],
            streams: []
        };
    }

    publishTransition({ objectType, state, sourceToken }) {
        const trackerId = `reolink:${sourceToken}:${objectType}`;
        return this.context.publishDetection({
            trackerId,
            objectType,
            state: state ? 'enter' : 'leave',
            timestamp: this.clock.now(),
            confidence: state ? 1 : 0,
            metadata: {
                provider: 'reolink',
                channel: Number(this.config.channel || 0),
                sourceToken
            }
        });
    }
}

module.exports = ReolinkCameraPlugin;
