'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const GatewayEventEngine = require('../src/core/event-engine');

function detection(overrides = {}) {
    return {
        cameraId: 'driveway',
        trackerId: 'person-1',
        type: 'person',
        state: 'enter',
        confidence: 0.94,
        boundingBox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
        timestamp: 1000,
        zones: ['front-yard'],
        attributes: { source: 'fixture' },
        ...overrides
    };
}

test('accepts a detection, tracks it, and dispatches it to outputs', async () => {
    const received = [];
    const engine = new GatewayEventEngine();
    engine.registerOutput('capture', {
        onDetection(value) {
            received.push(value);
        }
    });

    const result = await engine.accept(detection());

    assert.equal(result.accepted, true);
    assert.equal(result.detection.state, 'enter');
    assert.equal(result.detection.firstSeenTimestamp, 1000);
    assert.equal(result.deliveries[0].delivered, true);
    assert.deepEqual(received, [result.detection]);
    assert.deepEqual(engine.getActiveDetections(), [
        { ...result.detection, zones: ['front-yard'], attributes: { source: 'fixture' } }
    ]);
});

test('normalizes lifecycle transitions for existing and unknown trackers', async () => {
    const engine = new GatewayEventEngine();

    const first = await engine.accept(detection({ state: 'update' }));
    const second = await engine.accept(detection({
        state: 'enter',
        timestamp: 1100,
        confidence: 0.96
    }));
    const leave = await engine.accept(detection({
        state: 'leave',
        timestamp: 1200,
        confidence: undefined,
        boundingBox: null,
        zones: [],
        attributes: { reason: 'gone' }
    }));

    assert.equal(first.detection.state, 'enter');
    assert.equal(second.detection.state, 'update');
    assert.equal(second.detection.firstSeenTimestamp, 1000);
    assert.equal(leave.detection.state, 'leave');
    assert.equal(leave.detection.firstSeenTimestamp, 1000);
    assert.deepEqual(leave.detection.boundingBox, first.detection.boundingBox);
    assert.deepEqual(leave.detection.zones, ['front-yard']);
    assert.deepEqual(leave.detection.attributes, {
        source: 'fixture',
        reason: 'gone'
    });
    assert.deepEqual(engine.getActiveDetections(), []);
});

test('suppresses identical updates and orphaned leave events', async () => {
    const dispatched = [];
    const engine = new GatewayEventEngine();
    engine.registerOutput('capture', {
        onDetection(value) {
            dispatched.push(value);
        }
    });

    await engine.accept(detection());
    const duplicate = await engine.accept(detection({
        state: 'update',
        timestamp: 1100
    }));
    const orphanedLeave = await engine.accept(detection({
        cameraId: 'garage',
        trackerId: 'missing',
        state: 'leave',
        timestamp: 1200
    }));

    assert.equal(duplicate.accepted, false);
    assert.equal(duplicate.reason, 'duplicate');
    assert.equal(orphanedLeave.accepted, false);
    assert.equal(dispatched.length, 1);
    assert.equal(engine.getMetrics().duplicatesSuppressed, 2);
});

test('isolates output failures and reports delivery results', async () => {
    const delivered = [];
    const engine = new GatewayEventEngine();
    engine.registerOutput('broken', {
        onDetection() {
            throw new Error('offline');
        }
    });
    engine.registerOutput('healthy', {
        onDetection(value) {
            delivered.push(value.trackerId);
        }
    });

    const result = await engine.accept(detection());

    assert.deepEqual(delivered, ['person-1']);
    assert.deepEqual(
        result.deliveries.map(value => [value.id, value.delivered]),
        [['broken', false], ['healthy', true]]
    );
    assert.match(result.deliveries[0].error.message, /offline/);
    assert.equal(engine.getMetrics().outputFailures, 1);
});

test('validates identities and output contracts', async () => {
    const engine = new GatewayEventEngine();

    assert.throws(
        () => engine.registerOutput('', { onDetection() {} }),
        /output id/
    );
    assert.throws(
        () => engine.registerOutput('invalid', {}),
        /onDetection/
    );

    engine.registerOutput('valid', { onDetection() {} });
    assert.throws(
        () => engine.registerOutput('valid', { onDetection() {} }),
        /already registered/
    );
    await assert.rejects(
        engine.accept(detection({ cameraId: '' })),
        /cameraId/
    );
    await assert.rejects(
        engine.accept(detection({ trackerId: '' })),
        /trackerId/
    );
});

test('exposes stable metrics and output registration state', async () => {
    const engine = new GatewayEventEngine();
    engine.registerOutput('capture', { onDetection() {} });

    await engine.accept(detection());
    await engine.accept(detection({
        trackerId: 'vehicle-1',
        type: 'vehicle',
        timestamp: 2000
    }));

    assert.deepEqual(engine.getMetrics(), {
        detectionsReceived: 2,
        detectionsDispatched: 2,
        duplicatesSuppressed: 0,
        outputFailures: 0,
        activeObjects: 2,
        registeredOutputs: 1
    });

    assert.equal(engine.unregisterOutput('capture'), true);
    assert.equal(engine.unregisterOutput('capture'), false);
    assert.equal(engine.getMetrics().registeredOutputs, 0);
});
