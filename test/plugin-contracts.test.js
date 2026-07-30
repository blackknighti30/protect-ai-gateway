'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    PLUGIN_API_VERSION,
    PLUGIN_KINDS,
    validatePluginManifest,
    validatePluginModule
} = require('../src/plugins/plugin-contracts');

test('validates and normalizes a plugin manifest', () => {
    const manifest = validatePluginManifest({
        id: 'camera-reolink',
        name: 'Reolink Camera Adapter',
        version: '0.1.0',
        kind: PLUGIN_KINDS.CAMERA,
        apiVersion: PLUGIN_API_VERSION,
        capabilities: ['snapshot', 'events', 'snapshot']
    });

    assert.deepEqual(manifest.capabilities, ['snapshot', 'events']);
    assert.equal(Object.isFrozen(manifest), true);
});

test('rejects incompatible plugin API versions', () => {
    assert.throws(() => validatePluginManifest({
        id: 'camera-example',
        name: 'Example Camera',
        version: '1.0.0',
        kind: PLUGIN_KINDS.CAMERA,
        apiVersion: PLUGIN_API_VERSION + 1
    }), /requires API version/);
});

test('requires plugin modules to expose create(context)', () => {
    assert.throws(() => validatePluginModule({
        manifest: {
            id: 'output-protect',
            name: 'Protect Output',
            version: '0.1.0',
            kind: PLUGIN_KINDS.OUTPUT,
            apiVersion: PLUGIN_API_VERSION
        }
    }), /must export create/);
});
