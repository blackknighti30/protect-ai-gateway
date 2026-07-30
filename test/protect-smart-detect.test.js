'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildSmartDetectEnvelope,
    mapEdgeType,
    parseSmartDetectEnvelope
} = require('../src/protect/protocol/smart-detect');

const fixture = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'fixtures', 'ai-port-smart-detect-enter.json'),
    'utf8'
));

test('parses captured AI Port Smart Detect messages', () => {
    const parsed = parseSmartDetectEnvelope(fixture);

    assert.deepEqual(parsed.source, {
        connectionId: '942A6FEC9E2C-1785367563581',
        macAddress: '942A6FEC9E2C'
    });
    assert.equal(parsed.event.id, 1);
    assert.equal(parsed.event.cameraId, '1A11B035DB9D');
    assert.equal(parsed.event.state, 'enter');
    assert.equal(parsed.event.timestamp, 1785367848123);
    assert.deepEqual(parsed.event.zonesStatus, {
        1: { level: 52, status: 'enter' }
    });

    assert.equal(parsed.detections.length, 2);
    assert.deepEqual(parsed.detections[0], {
        cameraId: '1A11B035DB9D',
        trackerId: '10',
        type: 'person',
        state: 'enter',
        confidence: 96,
        boundingBox: { x: 323, y: 673, width: 146, height: 322 },
        timestamp: 1785367848123,
        firstSeenTimestamp: 1785367848040,
        stationary: false,
        zones: [],
        attributes: {
            associatedFaceTrackerId: 13,
            coord3d: [-1, -1],
            idleSinceTimestamp: 0,
            lines: [],
            loiterZones: [],
            secondLensZones: [],
            tag: ''
        }
    });
    assert.equal(parsed.detections[1].type, 'face');
    assert.equal(parsed.detections[1].trackerId, '13');
    assert.deepEqual(parsed.detections[1].zones, [1]);
    assert.deepEqual(parsed.detections[1].attributes.faceMask, {
        confidence: 0,
        val: 'face'
    });
});

test('maps moving messages to the normalized update state', () => {
    assert.equal(mapEdgeType('moving'), 'update');
});

test('builds the captured JSON envelope shape', () => {
    const envelope = buildSmartDetectEnvelope({
        timestamp: fixture.timestamp,
        offsetMs: fixture.offset_ms,
        connectionId: fixture.connection_id,
        macAddress: fixture.mac_address,
        payload: fixture.payload
    });

    assert.deepEqual(envelope, fixture);
});
