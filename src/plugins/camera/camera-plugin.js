'use strict';

const { normalizeCameraCapabilities } = require('./capabilities');

const OPTIONAL_CAMERA_METHODS = Object.freeze([
    'initialize',
    'getSnapshot',
    'getCapabilities'
]);

function validateCameraPlugin(id, camera) {
    if (typeof id !== 'string' || id.trim() === '')
        throw new TypeError('camera id must be a non-empty string');

    const normalizedId = id.trim();
    if (!camera || typeof camera !== 'object' || Array.isArray(camera))
        throw new TypeError(`camera ${normalizedId} must be an object`);

    for (const method of ['start', 'stop']) {
        if (typeof camera[method] !== 'function') {
            throw new TypeError(
                `camera ${normalizedId} must implement ${method}()`
            );
        }
    }

    for (const method of OPTIONAL_CAMERA_METHODS) {
        if (camera[method] !== undefined && typeof camera[method] !== 'function') {
            throw new TypeError(
                `camera ${normalizedId} ${method} must be a function when provided`
            );
        }
    }

    return Object.freeze({ id: normalizedId, camera });
}

async function initializeCameraPlugin(camera, context) {
    if (typeof camera.initialize === 'function')
        await camera.initialize(context);
    return camera;
}

async function getCameraCapabilities(camera) {
    const capabilities = typeof camera.getCapabilities === 'function'
        ? await camera.getCapabilities()
        : {};
    return normalizeCameraCapabilities(capabilities);
}

async function stopCameraPlugin(camera) {
    await camera.stop();
}

module.exports = {
    OPTIONAL_CAMERA_METHODS,
    validateCameraPlugin,
    initializeCameraPlugin,
    getCameraCapabilities,
    stopCameraPlugin
};
