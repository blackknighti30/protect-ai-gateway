'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
    validateOutputPlugin,
    initializeOutputPlugin,
    shutdownOutputPlugin
} = require('../src/plugins/output/output-plugin');
const {
    createOutputContext
} = require('../src/plugins/output/output-context');

test('validates the required output plugin contract', () => {
    const output = {
        async onDetection() {}
    };

    const validated = validateOutputPlugin(' protect ', output);

    assert.equal(validated.id, 'protect');
    assert.equal(validated.output, output);
    assert.equal(Object.isFrozen(validated), true);
});

test('accepts optional output lifecycle and snapshot methods', () => {
    const output = {
        async initialize() {},
        async onDetection() {},
        async onSnapshot() {},
        async shutdown() {}
    };

    assert.doesNotThrow(() => validateOutputPlugin('mqtt', output));
});

test('rejects invalid output plugin methods', () => {
    assert.throws(
        () => validateOutputPlugin('', { onDetection() {} }),
        /output id must be a non-empty string/
    );
    assert.throws(
        () => validateOutputPlugin('protect', {}),
        /must implement onDetection/
    );
    assert.throws(
        () => validateOutputPlugin('protect', {
            onDetection() {},
            shutdown: true
        }),
        /shutdown must be a function/
    );
});

test('creates an immutable output context', () => {
    const logger = { info() {} };
    const context = createOutputContext({
        id: ' protect ',
        config: { host: 'protect.local' },
        logger,
        services: { clock: () => 42 }
    });

    assert.equal(context.id, 'protect');
    assert.deepEqual(context.config, { host: 'protect.local' });
    assert.equal(context.logger, logger);
    assert.equal(typeof context.services.clock, 'function');
    assert.equal(Object.isFrozen(context), true);
    assert.equal(Object.isFrozen(context.config), true);
    assert.equal(Object.isFrozen(context.services), true);
});

test('runs output lifecycle hooks when implemented', async () => {
    const calls = [];
    const output = {
        async initialize(context) {
            calls.push(['initialize', context.id]);
        },
        async onDetection() {},
        async shutdown() {
            calls.push(['shutdown']);
        }
    };
    const context = createOutputContext({ id: 'protect' });

    assert.equal(await initializeOutputPlugin(output, context), output);
    await shutdownOutputPlugin(output);

    assert.deepEqual(calls, [
        ['initialize', 'protect'],
        ['shutdown']
    ]);
});
