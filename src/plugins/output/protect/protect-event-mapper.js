'use strict';

const { buildSmartDetectEnvelope } = require('../../../protect/protocol/smart-detect');

const EDGE_TYPES = Object.freeze({
    enter: 'enter',
    update: 'moving',
    leave: 'leave'
});

function finiteOr(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function normalizeConfidence(value) {
    const confidence = finiteOr(value, 0);
    if (confidence >= 0 && confidence <= 1)
        return Math.round(confidence * 100);
    return Math.max(0, Math.min(100, Math.round(confidence)));
}

function toCoord(box) {
    if (!box || typeof box !== 'object')
        return [0, 0, 0, 0];

    return [box.x, box.y, box.width, box.height].map(value =>
        finiteOr(value, 0)
    );
}

function toTrackerId(value) {
    const numeric = Number(value);
    if (Number.isSafeInteger(numeric) && numeric >= 0)
        return numeric;

    const text = String(value || '0');
    let hash = 2166136261;
    for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function mapDetectionToDescriptor(detection) {
    const attributes = detection.attributes || {};
    return {
        attributes: Object.keys(attributes).length ? { ...attributes } : null,
        boxColor: 'red',
        confidenceLevel: normalizeConfidence(detection.confidence),
        coord: toCoord(detection.boundingBox),
        coord3d: Array.isArray(attributes.coord3d) ? [...attributes.coord3d] : [-1, -1],
        firstShownTimeMs: finiteOr(
            detection.firstSeenTimestamp,
            detection.timestamp
        ),
        idleSinceTimeMs: finiteOr(attributes.idleSinceTimestamp, 0),
        lines: Array.isArray(attributes.lines) ? [...attributes.lines] : [],
        loiterZones: Array.isArray(attributes.loiterZones)
            ? [...attributes.loiterZones]
            : [],
        name: '',
        objectType: detection.type,
        secondLensZones: Array.isArray(attributes.secondLensZones)
            ? [...attributes.secondLensZones]
            : [],
        stationary: Boolean(detection.stationary),
        tag: typeof attributes.tag === 'string' ? attributes.tag : '',
        trackerID: toTrackerId(detection.trackerId),
        zones: Array.isArray(detection.zones) ? [...detection.zones] : []
    };
}

function buildProtectDetectionEnvelope(detection, options = {}) {
    if (!detection || typeof detection !== 'object')
        throw new TypeError('detection must be an object');

    const edgeType = EDGE_TYPES[detection.state];
    if (!edgeType)
        throw new Error(`Unsupported detection state: ${detection.state}`);

    const timestamp = finiteOr(detection.timestamp, Date.now());
    const eventId = options.eventId;
    if (!Number.isSafeInteger(eventId) || eventId < 0)
        throw new TypeError('eventId must be a non-negative safe integer');

    const cameraId = String(options.deviceId || detection.cameraId || '').trim();
    if (!cameraId)
        throw new TypeError('Protect device id must be a non-empty string');

    const descriptor = mapDetectionToDescriptor(detection);
    const streamRate = finiteOr(options.clockStreamRate, 1000);
    const monotonic = finiteOr(options.clockMonotonic, timestamp);

    return buildSmartDetectEnvelope({
        timestamp: options.envelopeTimestamp || new Date(timestamp).toISOString(),
        offsetMs: finiteOr(options.offsetMs, 0),
        connectionId: options.connectionId || null,
        macAddress: options.macAddress || null,
        payload: {
            clockMonotonic: monotonic,
            clockStream: finiteOr(options.clockStream, monotonic),
            clockStreamRate: streamRate,
            clockWall: timestamp,
            descriptors: [descriptor],
            deviceID: cameraId,
            displayTimeoutMSec: finiteOr(options.displayTimeoutMs, 250),
            edgeType,
            eventId,
            objectTypes: [detection.type],
            smartDetectSnapshotFullFoV: '',
            smartDetectSnapshotFullFoVHeight: 0,
            smartDetectSnapshotFullFoVWidth: 0,
            smartDetectSnapshots: [],
            zonesStatus: {}
        }
    });
}

module.exports = {
    EDGE_TYPES,
    buildProtectDetectionEnvelope,
    mapDetectionToDescriptor,
    normalizeConfidence,
    toTrackerId
};
