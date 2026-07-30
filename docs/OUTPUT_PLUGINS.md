# Output Plugin SDK

Output plugins receive normalized gateway events and translate them into an external protocol or integration. Protect, ONVIF, MQTT, and webhook outputs all share the same contract.

## Contract

Every output must implement:

```js
async onDetection(detection) {}
```

Outputs may also implement:

```js
async initialize(context) {}
async onSnapshot(snapshot) {}
async shutdown() {}
```

`initialize()` receives an immutable context containing the output ID, plugin manifest, configuration, logger, and shared services. `shutdown()` releases resources owned by the output. Snapshot delivery is optional until the gateway snapshot pipeline is introduced.

## Validation

Use `validateOutputPlugin(id, output)` before registration. The gateway event engine uses the same validator, so malformed outputs fail immediately rather than during event dispatch.

```js
const {
    validateOutputPlugin
} = require('../src/plugins/output/output-plugin');

validateOutputPlugin('protect', {
    async onDetection(detection) {
        // Serialize and publish the normalized detection.
    }
});
```

## Context

Create output contexts with `createOutputContext()`:

```js
const {
    createOutputContext
} = require('../src/plugins/output/output-context');

const context = createOutputContext({
    id: 'protect',
    config: { host: 'protect.local' },
    logger,
    services: { clock }
});
```

The context and its `config` and `services` records are frozen. Outputs should keep their own mutable runtime state inside the plugin instance.

## Failure isolation

The event engine invokes outputs concurrently. A rejected `onDetection()` call is reported as a failed delivery and increments output-failure metrics without preventing delivery to other outputs.
