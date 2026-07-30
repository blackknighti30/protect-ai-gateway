'use strict';

const {
    STATES,
    normalizeBoundingBox,
    normalizeDetection
} = require('../../detections/detection');

const FUNCTION_NAME = 'EventSmartDetect';

function mapEdgeType(edgeType) {
    switch (String(edgeType || '').toLowerCase()) {
    case 'enter':
        return STATES.ENTER;
    case 'leave':
        return STATES.LEAVE;
    case 'moving':
    case 'update':
        return STATES.UPDATE;
    default:
        throw new Error(`Unsupported Smart Detect edge type: ${edgeType}`);
    }
}

function parseDescriptor(payload, descriptor) {
    return normalizeDetection({
        cameraId: payload.deviceID,
        trackerId: descriptor.trackerID,
        type: descriptor.objectType,
        state: mapEdgeType(payload.edgeType),
        confidence: descriptor.confidenceLevel,
        boundingBox: normalizeBoundingBox(descriptor.coord),
        timestamp: payload.clockWall,
        firstSeenTimestamp: descriptor.firstShownTimeMs,
        stationary: descriptor.stationary,
        zones: descriptor.zones,
        attributes: {
            ...(descriptor.attributes || {}),
            associatedFaceTrackerId: descriptor.associatedFaceTrackerID,
            coord3d: descriptor.coord3d,
            idleSinceTimestamp: descriptor.idleSinceTimeMs,
            lines: descriptor.lines,
            loiterZones: descriptor.loiterZones,
            secondLensZones: descriptor.secondLensZones,
            tag: descriptor.tag
        }
    });
}

function parseSmartDetectEnvelope(envelope) {
    if (!envelope || typeof envelope !== 'object')
        throw new TypeError('Smart Detect envelope must be an object');

    if (envelope.function_name !== FUNCTION_NAME)
        throw new Error(
            `Expected ${FUNCTION_NAME}, received ${envelope.function_name}`
        );

    const payload = envelope.payload;
    if (!payload || typeof payload !== 'object')
        throw new TypeError('Smart Detect payload must be an object');

    const descriptors = Array.isArray(payload.descriptors)
        ? payload.descriptors
        : [];

    return {
        source: {
            connectionId: envelope.connection_id || null,
            macAddress: envelope.mac_address || null
        },
        event: {
            id: payload.eventId,
            cameraId: payload.deviceID,
            state: mapEdgeType(payload.edgeType),
            timestamp: payload.clockWall,
            clockMonotonic: payload.clockMonotonic,
            clockStream: payload.clockStream,
            clockStreamRate: payload.clockStreamRate,
            displayTimeoutMs: payload.displayTimeoutMSec,
            objectTypes: Array.isArray(payload.objectTypes)
                ? [...payload.objectTypes]
                : [],
            zonesStatus: payload.zonesStatus || {},
            snapshots: Array.isArray(payload.smartDetectSnapshots)
                ? [...payload.smartDetectSnapshots]
                : [],
            fullFrameSnapshot: payload.smartDetectSnapshotFullFoV || '',
            fullFrameSnapshotWidth:
                payload.smartDetectSnapshotFullFoVWidth || 0,
            fullFrameSnapshotHeight:
                payload.smartDetectSnapshotFullFoVHeight || 0
        },
        detections: descriptors.map(descriptor =>
            parseDescriptor(payload, descriptor)
        )
    };
}

function buildSmartDetectEnvelope(options) {
    if (!options || typeof options !== 'object')
        throw new TypeError('Smart Detect options must be an object');

    const payload = options.payload;
    if (!payload || typeof payload !== 'object')
        throw new TypeError('Smart Detect payload must be an object');

    return {
        timestamp: options.timestamp || new Date().toISOString(),
        offset_ms: options.offsetMs || 0,
        connection_id: options.connectionId || null,
        mac_address: options.macAddress || null,
        function_name: FUNCTION_NAME,
        payload
    };
}

module.exports = {
    FUNCTION_NAME,
    buildSmartDetectEnvelope,
    mapEdgeType,
    parseSmartDetectEnvelope
};
