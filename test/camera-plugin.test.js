'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
    validateCameraPlugin,
    initializeCameraPlugin,
    getCameraCapabilities,
    stopCameraPlugin
} = require('../src/plugins/camera/camera-plugin');
const {
    createCameraContext
} = require('../src/plugins/camera/camera-context');
const {
    normalizeCameraCapabilities
} = require('../src/plugins/camera/capabilities');

test('validates the required camera plugin contract', () => {
    const camera = { async start() {}, async stop() {} };
    const validated = validateCameraPlugin(' driveway ', camera);

    assert.equal(validated.id, 'driveway');
    assert.equal(validated.camera, camera);
    assert.equal(Object.isFrozen(validated), true);
});

test('rejects incomplete camera plugins and invalid optional methods', () => {
    assert.throws(
        () => validateCameraPlugin('camera', { async stop() {} }),
        /must implement start/
    );
    assert.throws(
        () => validateCameraPlugin('camera', {
            async start() {},
            async stop() {},
            getSnapshot: true
        }),
        /getSnapshot must be a function/
    );
});

test('initializes and stops camera plugins through lifecycle helpers', async () => {
    const calls = [];
    const context = { id: 'driveway' };
    const camera = {
        async initialize(received) { calls.push(['initialize', received]); },
        async start() {},
        async stop() { calls.push(['stop']); }
    };

    assert.equal(await initializeCameraPlugin(camera, context), camera);
    await stopCameraPlugin(camera);
    assert.deepEqual(calls, [['initialize', context], ['stop']]);
});

test('camera context assigns identity and publishes normalized detections', async () => {
    const published = [];
    const context = createCameraContext({
        id: ' driveway ',
        config: { channel: 0 },
        publishDetection: async detection => {
            published.push(detection);
            return { accepted: true };
        }
    });

    const result = await context.publishDetection({
        cameraId: 'spoofed-camera',
        trackerId: 'person-1',
        type: 'person',
        state: 'enter',
        timestamp: 1000
    });

    assert.deepEqual(result, { accepted: true });
    assert.equal(published[0].cameraId, 'driveway');
    assert.equal(published[0].trackerId, 'person-1');
    assert.equal(Object.isFrozen(context), true);
    assert.equal(Object.isFrozen(context.config), true);
});

test('camera context publishes camera-scoped snapshots', async () => {
    const published = [];
    const context = createCameraContext({
        id: 'garage',
        publishDetection: async () => {},
        publishSnapshot: async snapshot => published.push(snapshot)
    });

    await context.publishSnapshot({
        contentType: 'image/jpeg',
        data: Buffer.from('jpeg')
    });

    assert.equal(published[0].cameraId, 'garage');
    assert.equal(published[0].contentType, 'image/jpeg');
});

test('normalizes camera capabilities and infers PTZ support', async () => {
    const capabilities = normalizeCameraCapabilities({
        detections: 1,
        zoom: true,
        objectTypes: ['person', 'person', 'vehicle'],
        streams: ['main', 'sub']
    });

    assert.equal(capabilities.detections, true);
    assert.equal(capabilities.zoom, true);
    assert.equal(capabilities.ptz, true);
    assert.deepEqual(capabilities.objectTypes, ['person', 'vehicle']);
    assert.equal(Object.isFrozen(capabilities), true);

    const fromPlugin = await getCameraCapabilities({
        async getCapabilities() { return { snapshots: true }; }
    });
    assert.equal(fromPlugin.snapshots, true);
});
