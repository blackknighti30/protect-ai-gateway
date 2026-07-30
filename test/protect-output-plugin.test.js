'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createOutputContext } = require('../src/plugins/output/output-context');
const {
    ProtectOutputPlugin,
    buildProtectDetectionEnvelope,
    manifest,
    normalizeConfidence,
    toTrackerId
} = require('../src/plugins/output/protect');

function detection(overrides = {}) {
    return {
        cameraId: 'camera-1',
        trackerId: 'reolink:ai:person',
        type: 'person',
        state: 'enter',
        confidence: 0.96,
        boundingBox: { x: 10, y: 20, width: 30, height: 40 },
        timestamp: 1785367848123,
        firstSeenTimestamp: 1785367848000,
        stationary: false,
        zones: [1],
        attributes: {},
        ...overrides
    };
}

test('exports a valid Protect output manifest', () => {
    assert.deepEqual(manifest, {
        apiVersion: '1',
        kind: 'output',
        name: 'protect',
        version: '0.1.0'
    });
});

test('maps a normalized detection to captured Smart Detect shape', () => {
    const envelope = buildProtectDetectionEnvelope(detection(), {
        eventId: 7,
        deviceId: '1A11B035DB9D',
        connectionId: 'connection-1',
        macAddress: '1A11B035DB9D',
        clockMonotonic: 1234,
        clockStream: 1234
    });

    assert.equal(envelope.function_name, 'EventSmartDetect');
    assert.equal(envelope.payload.eventId, 7);
    assert.equal(envelope.payload.edgeType, 'enter');
    assert.equal(envelope.payload.deviceID, '1A11B035DB9D');
    assert.deepEqual(envelope.payload.objectTypes, ['person']);
    assert.deepEqual(envelope.payload.descriptors[0].coord, [10, 20, 30, 40]);
    assert.equal(envelope.payload.descriptors[0].confidenceLevel, 96);
    assert.deepEqual(envelope.payload.descriptors[0].zones, [1]);
});

test('maps updates to moving and leaves to leave', () => {
    assert.equal(buildProtectDetectionEnvelope(
        detection({ state: 'update' }), { eventId: 1 }
    ).payload.edgeType, 'moving');
    assert.equal(buildProtectDetectionEnvelope(
        detection({ state: 'leave' }), { eventId: 2 }
    ).payload.edgeType, 'leave');
});

test('creates stable numeric tracker ids and confidence percentages', () => {
    assert.equal(toTrackerId('42'), 42);
    assert.equal(toTrackerId('stable-token'), toTrackerId('stable-token'));
    assert.equal(normalizeConfidence(0.91), 91);
    assert.equal(normalizeConfidence(83.6), 84);
});

test('publishes sequenced envelopes through an injected transport', async () => {
    const sent = [];
    const calls = [];
    const transport = {
        async connect() { calls.push('connect'); },
        async send(envelope) { sent.push(envelope); },
        async close() { calls.push('close'); }
    };
    const context = createOutputContext({
        id: 'protect-main',
        services: { transport }
    });
    const plugin = new ProtectOutputPlugin(context, {
        deviceId: 'protect-device',
        initialEventId: 20
    }, { clock: { now: () => 5000 } });

    await plugin.initialize();
    const first = await plugin.onDetection(detection());
    const second = await plugin.onDetection(detection({ state: 'leave' }));
    await plugin.shutdown();

    assert.deepEqual(calls, ['connect', 'close']);
    assert.equal(first.eventId, 20);
    assert.equal(second.eventId, 21);
    assert.equal(sent.length, 2);
    assert.equal(sent[0].payload.deviceID, 'protect-device');
    assert.equal(sent[1].payload.edgeType, 'leave');
});

test('forwards snapshots only when the transport supports them', async () => {
    const snapshots = [];
    const context = createOutputContext({
        id: 'protect-main',
        services: {
            transport: {
                async send() {},
                async sendSnapshot(snapshot) { snapshots.push(snapshot); }
            }
        }
    });
    const plugin = new ProtectOutputPlugin(context);
    const snapshot = { cameraId: 'camera-1', data: Buffer.from('jpeg') };

    assert.equal(await plugin.onSnapshot(snapshot), true);
    assert.deepEqual(snapshots, [snapshot]);
});
