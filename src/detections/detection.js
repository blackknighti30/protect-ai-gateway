'use strict';

const STATES = Object.freeze({
    ENTER: 'enter',
    UPDATE: 'update',
    LEAVE: 'leave'
});

const OBJECT_TYPES = Object.freeze({
    PERSON: 'person',
    VEHICLE: 'vehicle',
    ANIMAL: 'animal',
    PACKAGE: 'package',
    FACE: 'face',
    LICENSE_PLATE: 'licensePlate',
    UNKNOWN: 'unknown'
});

function requireFiniteNumber(value, name) {
    const number = Number(value);
    if (!Number.isFinite(number))
        throw new TypeError(`${name} must be a finite number`);
    return number;
}

function normalizeBoundingBox(coord) {
    if (!Array.isArray(coord) || coord.length !== 4)
        return null;

    const [x, y, width, height] = coord.map((value, index) =>
        requireFiniteNumber(value, `coord[${index}]`)
    );

    return { x, y, width, height };
}

function normalizeDetection(input) {
    if (!input || typeof input !== 'object')
        throw new TypeError('Detection must be an object');

    const state = String(input.state || '').trim();
    if (!Object.values(STATES).includes(state))
        throw new Error(`Unsupported detection state: ${state}`);

    const type = String(input.type || OBJECT_TYPES.UNKNOWN).trim();
    const confidence = input.confidence == null
        ? undefined
        : requireFiniteNumber(input.confidence, 'confidence');

    return Object.freeze({
        cameraId: String(input.cameraId || '').trim(),
        trackerId: String(input.trackerId || '').trim(),
        type,
        state,
        confidence,
        boundingBox: input.boundingBox || null,
        timestamp: requireFiniteNumber(input.timestamp, 'timestamp'),
        firstSeenTimestamp: input.firstSeenTimestamp == null
            ? undefined
            : requireFiniteNumber(
                input.firstSeenTimestamp,
                'firstSeenTimestamp'
            ),
        stationary: Boolean(input.stationary),
        zones: Array.isArray(input.zones) ? [...input.zones] : [],
        attributes: input.attributes && typeof input.attributes === 'object'
            ? { ...input.attributes }
            : {}
    });
}

module.exports = {
    OBJECT_TYPES,
    STATES,
    normalizeBoundingBox,
    normalizeDetection
};
