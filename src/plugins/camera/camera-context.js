'use strict';

const { normalizeDetection } = require('../../detections/detection');

function assertRecord(value, name) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new TypeError(`${name} must be an object`);
    return value;
}

function freezeRecord(value) {
    return Object.freeze({ ...value });
}

function createCameraContext(options = {}) {
    assertRecord(options, 'camera context options');

    if (typeof options.id !== 'string' || options.id.trim() === '')
        throw new TypeError('camera context id must be a non-empty string');
    if (typeof options.publishDetection !== 'function') {
        throw new TypeError(
            'camera context publishDetection must be a function'
        );
    }
    if (options.publishSnapshot !== undefined &&
        typeof options.publishSnapshot !== 'function') {
        throw new TypeError(
            'camera context publishSnapshot must be a function when provided'
        );
    }

    const id = options.id.trim();
    const config = options.config === undefined
        ? {}
        : assertRecord(options.config, 'camera context config');
    const services = options.services === undefined
        ? {}
        : assertRecord(options.services, 'camera context services');

    return Object.freeze({
        id,
        manifest: options.manifest || null,
        config: freezeRecord(config),
        logger: options.logger || null,
        services: freezeRecord(services),

        async publishDetection(input) {
            const detection = normalizeDetection({
                ...input,
                cameraId: id
            });
            return options.publishDetection(detection);
        },

        async publishSnapshot(snapshot) {
            if (!options.publishSnapshot)
                throw new Error(`camera ${id} does not have a snapshot publisher`);
            return options.publishSnapshot(Object.freeze({
                ...assertRecord(snapshot, 'snapshot'),
                cameraId: id
            }));
        }
    });
}

module.exports = {
    createCameraContext
};
