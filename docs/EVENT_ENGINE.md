# Gateway Event Engine

The gateway event engine is the vendor- and protocol-neutral center of Protect AI Gateway. It accepts normalized detections, maintains active object state, suppresses redundant updates, and fans lifecycle events out to registered outputs.

## Contract

```js
const GatewayEventEngine = require('./src/core/event-engine');

const engine = new GatewayEventEngine({ logger });

engine.registerOutput('protect', {
    async onDetection(detection) {
        // Serialize and publish through the Protect transport.
    }
});

await engine.accept({
    cameraId: 'driveway',
    trackerId: 'person-42',
    type: 'person',
    state: 'enter',
    timestamp: Date.now()
});
```

`accept()` validates the detection with the shared normalized detection model. A tracker is uniquely identified by the combination of `cameraId` and `trackerId`.

## Lifecycle normalization

The engine owns lifecycle consistency:

- The first `enter` or `update` for a tracker is emitted as `enter`.
- Further changed `enter` or `update` messages are emitted as `update`.
- An unchanged update is suppressed even when its timestamp changes.
- A `leave` for an active tracker is emitted and removes it from active state.
- A `leave` for an unknown tracker is suppressed.

The original `firstSeenTimestamp` is retained throughout the lifecycle.

## Output isolation

Outputs implement `onDetection(detection)`. They are invoked concurrently. A failure in one output is returned as a failed delivery and counted in metrics, but it does not prevent other outputs from receiving the event.

## Diagnostics

`getMetrics()` reports:

- detections received
- detections dispatched
- duplicates suppressed
- output failures
- active objects
- registered outputs

`getActiveDetections()` returns a snapshot of the currently active object state.

## Deliberate exclusions

The first implementation does not provide expiration timers, persistence, snapshots, enrichment, cross-camera correlation, or network transports. Those features will build on this lifecycle and dispatch contract in focused changes.
