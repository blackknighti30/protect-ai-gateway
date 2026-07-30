'use strict';

function assertRecord(value, field) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new TypeError(`${field} must be an object`);

    return value;
}

function freezeRecord(value) {
    return Object.freeze({ ...value });
}

function createOutputContext(options = {}) {
    assertRecord(options, 'output context options');

    if (typeof options.id !== 'string' || options.id.trim() === '')
        throw new TypeError('output context id must be a non-empty string');

    if (options.logger !== undefined && options.logger !== null &&
        typeof options.logger !== 'object' && typeof options.logger !== 'function') {
        throw new TypeError('output context logger must be an object or function');
    }

    const config = options.config === undefined
        ? {}
        : assertRecord(options.config, 'output context config');
    const services = options.services === undefined
        ? {}
        : assertRecord(options.services, 'output context services');

    return Object.freeze({
        id: options.id.trim(),
        manifest: options.manifest || null,
        config: freezeRecord(config),
        logger: options.logger || null,
        services: freezeRecord(services)
    });
}

module.exports = {
    createOutputContext
};
