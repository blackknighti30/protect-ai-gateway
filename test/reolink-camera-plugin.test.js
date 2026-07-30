'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const ReolinkCameraPlugin = require('../src/plugins/camera/reolink/reolink-camera-plugin');
const ReolinkAnalyticsController = require('../src/plugins/camera/reolink/reolink-analytics-controller');
const ReolinkMotionController = require('../src/plugins/camera/reolink/reolink-motion-controller');

function context(published = []) {
    return {
        logger: { debug() {}, info() {}, error() {} },
        publishDetection(detection) {
            published.push(detection);
            return detection;
        }
    };
}

function dependencies() {
    return {
        client: { async login() {}, async getSnapshot() { return { data: Buffer.from([0xff, 0xd8, 0xff, 0xd9]), contentType: 'image/jpeg' }; } },
        motion: { start() {}, async close() {} },
        analytics: { start() {}, async close() {} },
        clock: { now: () => 1234 }
    };
}

test('maps Reolink transitions to camera-context detections', () => {
    const published = [];
    const plugin = new ReolinkCameraPlugin(context(published), { channel: 2 }, dependencies());

    plugin.publishTransition({ objectType: 'person', state: true, sourceToken: 'wide' });
    plugin.publishTransition({ objectType: 'person', state: false, sourceToken: 'wide' });

    assert.deepEqual(published.map(item => ({
        trackerId: item.trackerId,
        objectType: item.objectType,
        state: item.state,
        timestamp: item.timestamp
    })), [
        { trackerId: 'reolink:wide:person', objectType: 'person', state: 'enter', timestamp: 1234 },
        { trackerId: 'reolink:wide:person', objectType: 'person', state: 'leave', timestamp: 1234 }
    ]);
});

test('exposes detection and snapshot capabilities', () => {
    const plugin = new ReolinkCameraPlugin(context(), {}, dependencies());
    const capabilities = plugin.getCapabilities();
    assert.equal(capabilities.detections, true);
    assert.equal(capabilities.snapshots, true);
    assert.deepEqual(capabilities.objectTypes, ['motion', 'person', 'vehicle', 'pet']);
});

test('normalizes Reolink motion and AI response variants', () => {
    assert.equal(ReolinkMotionController.normalizeMotionState({ State: 'on' }), true);
    assert.deepEqual(ReolinkAnalyticsController.normalizeAiState({
        people: { alarm_state: 1 },
        vehicle: { alarm_state: 0 },
        dog_cat: { alarm_state: 'true' }
    }), { person: true, vehicle: false, pet: true });
});
