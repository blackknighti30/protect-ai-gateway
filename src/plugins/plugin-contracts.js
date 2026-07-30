'use strict';

const PLUGIN_API_VERSION = 1;

const PLUGIN_KINDS = Object.freeze({
    CAMERA: 'camera',
    DETECTOR: 'detector',
    ENRICHER: 'enricher',
    OUTPUT: 'output'
});

const VALID_PLUGIN_KINDS = new Set(Object.values(PLUGIN_KINDS));
const PLUGIN_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function assertNonEmptyString(value, field) {
    if (typeof value !== 'string' || value.trim() === '')
        throw new TypeError(`${field} must be a non-empty string`);

    return value.trim();
}

function validatePluginManifest(manifest) {
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest))
        throw new TypeError('plugin manifest must be an object');

    const id = assertNonEmptyString(manifest.id, 'plugin manifest id');
    if (!PLUGIN_ID_PATTERN.test(id)) {
        throw new TypeError(
            'plugin manifest id must contain lowercase letters, numbers, and single hyphens'
        );
    }

    const name = assertNonEmptyString(manifest.name, 'plugin manifest name');
    const version = assertNonEmptyString(
        manifest.version,
        'plugin manifest version'
    );
    const kind = assertNonEmptyString(manifest.kind, 'plugin manifest kind');

    if (!VALID_PLUGIN_KINDS.has(kind))
        throw new TypeError(`unsupported plugin kind: ${kind}`);

    const apiVersion = Number(manifest.apiVersion);
    if (!Number.isInteger(apiVersion) || apiVersion < 1) {
        throw new TypeError(
            'plugin manifest apiVersion must be a positive integer'
        );
    }

    if (apiVersion !== PLUGIN_API_VERSION) {
        throw new Error(
            `plugin ${id} requires API version ${apiVersion}; ` +
            `gateway supports version ${PLUGIN_API_VERSION}`
        );
    }

    const capabilities = manifest.capabilities === undefined
        ? []
        : manifest.capabilities;

    if (!Array.isArray(capabilities) ||
        capabilities.some(value => typeof value !== 'string' || value.trim() === '')) {
        throw new TypeError(
            'plugin manifest capabilities must be an array of non-empty strings'
        );
    }

    return Object.freeze({
        id,
        name,
        version,
        kind,
        apiVersion,
        capabilities: Object.freeze(
            [...new Set(capabilities.map(value => value.trim()))]
        )
    });
}

function validatePluginModule(pluginModule) {
    if (!pluginModule ||
        typeof pluginModule !== 'object' ||
        Array.isArray(pluginModule)) {
        throw new TypeError('plugin module must be an object');
    }

    const manifest = validatePluginManifest(pluginModule.manifest);

    if (typeof pluginModule.create !== 'function')
        throw new TypeError(`plugin ${manifest.id} must export create(context)`);

    return Object.freeze({
        manifest,
        create: pluginModule.create
    });
}

module.exports = {
    PLUGIN_API_VERSION,
    PLUGIN_KINDS,
    validatePluginManifest,
    validatePluginModule
};
