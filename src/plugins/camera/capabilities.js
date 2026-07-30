'use strict';

const CAPABILITY_KEYS = Object.freeze([
    'detections',
    'snapshots',
    'ptz',
    'pan',
    'tilt',
    'zoom',
    'presets',
    'audio'
]);

function normalizeStringList(value, name) {
    if (value === undefined)
        return Object.freeze([]);
    if (!Array.isArray(value))
        throw new TypeError(`${name} must be an array`);

    return Object.freeze([...new Set(value.map(item => {
        if (typeof item !== 'string' || item.trim() === '')
            throw new TypeError(`${name} entries must be non-empty strings`);
        return item.trim();
    }))]);
}

function normalizeCameraCapabilities(input = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input))
        throw new TypeError('camera capabilities must be an object');

    const normalized = {};
    for (const key of CAPABILITY_KEYS)
        normalized[key] = Boolean(input[key]);

    normalized.objectTypes = normalizeStringList(
        input.objectTypes,
        'camera capabilities objectTypes'
    );
    normalized.streams = normalizeStringList(
        input.streams,
        'camera capabilities streams'
    );

    if (normalized.pan || normalized.tilt || normalized.zoom || normalized.presets)
        normalized.ptz = true;

    return Object.freeze(normalized);
}

module.exports = {
    CAPABILITY_KEYS,
    normalizeCameraCapabilities
};
