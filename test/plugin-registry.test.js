'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const PluginRegistry = require('../src/plugins/plugin-registry');
const {
    PLUGIN_API_VERSION,
    PLUGIN_KINDS
} = require('../src/plugins/plugin-contracts');

function makePlugin(id, kind, hooks = {}) {
    return {
        manifest: {
            id,
            name: id,
            version: '0.1.0',
            kind,
            apiVersion: PLUGIN_API_VERSION
        },
        async create(context) {
            if (hooks.create)
                await hooks.create(context);

            return {
                async start() {
                    if (hooks.start)
                        await hooks.start();
                },
                async stop() {
                    if (hooks.stop)
                        await hooks.stop();
                }
            };
        }
    };
}

test('registers, lists, starts, and stops plugins', async () => {
    const calls = [];
    const registry = new PluginRegistry({ logger: 'test-logger' });

    registry.register(makePlugin(
        'camera-reolink',
        PLUGIN_KINDS.CAMERA,
        {
            create(context) {
                calls.push(['create', context.logger, context.config.host]);
            },
            start() {
                calls.push(['start']);
            },
            stop() {
                calls.push(['stop']);
            }
        }
    ));

    assert.equal(registry.has('camera-reolink'), true);
    assert.equal(registry.list(PLUGIN_KINDS.CAMERA).length, 1);

    await registry.start('camera-reolink', { host: '192.0.2.10' });
    await registry.stop('camera-reolink');

    assert.deepEqual(calls, [
        ['create', 'test-logger', '192.0.2.10'],
        ['start'],
        ['stop']
    ]);
});

test('rejects duplicate registrations and duplicate starts', async () => {
    const registry = new PluginRegistry();
    const plugin = makePlugin('detector-example', PLUGIN_KINDS.DETECTOR);

    registry.register(plugin);
    assert.throws(() => registry.register(plugin), /already registered/);

    await registry.start('detector-example');
    await assert.rejects(
        registry.start('detector-example'),
        /already started/
    );

    await registry.close();
});
