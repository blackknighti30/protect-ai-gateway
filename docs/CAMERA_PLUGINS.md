# Camera Plugin SDK

Camera plugins are input adapters for Protect AI Gateway. They translate a camera or detector's vendor-specific APIs into normalized detections, snapshots, and capabilities. They never import the gateway event engine or an output protocol directly.

## Contract

A camera plugin must implement:

```js
{
    async start() {},
    async stop() {}
}
```

It may also implement:

```js
async initialize(context) {}
async getSnapshot(options) {}
async getCapabilities() {}
```

`initialize()` receives an immutable camera context. The context provides configuration, logging, shared services, and the only supported publication methods:

```js
await context.publishDetection({
    trackerId: 'person-42',
    type: 'person',
    state: 'enter',
    timestamp: Date.now()
});
```

The context assigns the configured camera ID and validates the normalized detection before forwarding it to the gateway. A plugin cannot spoof another camera's identity.

## Capabilities

`getCapabilities()` may advertise boolean features including detections, snapshots, PTZ, pan, tilt, zoom, presets, and audio. It may also return `objectTypes` and `streams` arrays. Capability results are normalized and immutable. Any pan, tilt, zoom, or preset support implies PTZ support.

## Lifecycle

The gateway initializes a plugin once, starts it when the camera should begin producing events, and stops it during shutdown. `stop()` must release timers, sockets, subscriptions, and other resources. The SDK intentionally does not choose a polling or push-event strategy.

## Boundaries

Camera plugins may know about their camera vendor. They must not know about Protect, ONVIF output, MQTT, or the event engine implementation. Output delivery and lifecycle state remain responsibilities of the gateway core.
