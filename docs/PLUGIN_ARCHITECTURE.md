# Protect AI Gateway plugin architecture

Protect AI Gateway is built around small, versioned plugin contracts. Camera
vendors, detection engines, enrichment systems, and outputs remain outside the
gateway core.

## Plugin kinds

- `camera`: discovers or connects to cameras and exposes camera capabilities.
- `detector`: converts frames or external events into normalized detections.
- `enricher`: adds metadata such as face, plate, or vehicle attributes.
- `output`: publishes normalized gateway events to Protect, ONVIF, MQTT, or
  another destination.

A plugin may implement one kind. Integrations needing multiple roles should
ship multiple plugins so that each lifecycle and failure boundary stays clear.

## Manifest

Every plugin exports a manifest and a factory:

```javascript
module.exports = {
    manifest: {
        id: 'camera-example',
        name: 'Example Camera Adapter',
        version: '0.1.0',
        kind: 'camera',
        apiVersion: 1,
        capabilities: ['snapshot', 'events']
    },

    async create(context) {
        return {
            async start() {},
            async stop() {}
        };
    }
};
```

Plugin IDs use lowercase letters, numbers, and hyphens. The API version is
checked before any plugin code is started.

## Lifecycle

1. The gateway validates the manifest.
2. The plugin is registered by ID.
3. `create(context)` receives shared services and plugin configuration.
4. Optional `start()` is awaited.
5. During shutdown, optional `stop()` or `close()` is awaited.
6. One plugin failure must not prevent other plugin instances from stopping.

The first implementation runs in-process to establish the contract. The
contract deliberately avoids Node-specific global state so a later release can
move untrusted community plugins into worker processes or containers without
changing plugin-facing APIs.

## Compatibility rules

- Additive manifest fields are allowed.
- Existing required fields must not change meaning within an API version.
- Breaking contract changes require a new `apiVersion`.
- The normalized detection model belongs to the gateway core, not any plugin.
- Protect protocol details belong to the Protect output implementation.
- Camera credentials must remain inside the camera plugin context.
