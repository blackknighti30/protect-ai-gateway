'use strict';

const OPTIONAL_OUTPUT_METHODS = Object.freeze([
    'initialize',
    'onSnapshot',
    'shutdown'
]);

function validateOutputPlugin(id, output) {
    if (typeof id !== 'string' || id.trim() === '')
        throw new TypeError('output id must be a non-empty string');

    const normalizedId = id.trim();
    if (!output || typeof output !== 'object' || Array.isArray(output))
        throw new TypeError(`output ${normalizedId} must be an object`);

    if (typeof output.onDetection !== 'function') {
        throw new TypeError(
            `output ${normalizedId} must implement onDetection(detection)`
        );
    }

    for (const method of OPTIONAL_OUTPUT_METHODS) {
        if (output[method] !== undefined && typeof output[method] !== 'function') {
            throw new TypeError(
                `output ${normalizedId} ${method} must be a function when provided`
            );
        }
    }

    return Object.freeze({
        id: normalizedId,
        output
    });
}

async function initializeOutputPlugin(output, context) {
    if (typeof output.initialize === 'function')
        await output.initialize(context);

    return output;
}

async function shutdownOutputPlugin(output) {
    if (typeof output.shutdown === 'function')
        await output.shutdown();
}

module.exports = {
    OPTIONAL_OUTPUT_METHODS,
    validateOutputPlugin,
    initializeOutputPlugin,
    shutdownOutputPlugin
};
