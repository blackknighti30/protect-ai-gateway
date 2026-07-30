# Protect output plugin

The Protect output plugin translates normalized gateway detections into the
captured `EventSmartDetect` JSON envelope used by UniFi Protect AI Port.

## Boundary

This patch intentionally separates protocol mapping from transport:

```text
normalized detection
        |
        v
Protect output plugin
        |
        v
EventSmartDetect JSON envelope
        |
        v
injected transport
```

The transport must implement:

```js
await transport.send(envelope)
```

It may also implement `connect()`, `close()`, and `sendSnapshot(snapshot)`.
The later secure-transfer patch will provide the mTLS WebSocket transport and
AI Port registration/heartbeat implementation without changing this plugin.

## Configuration

- `deviceId`: optional Protect-facing camera identifier; defaults to the
  normalized detection camera ID.
- `connectionId`: optional captured-protocol connection identifier.
- `macAddress`: optional AI Port MAC address.
- `initialEventId`: first event sequence number; defaults to `1`.
- `displayTimeoutMs`: Smart Detect display timeout; defaults to `250`.
- `offsetMs`: envelope offset; defaults to `0`.

Each normalized detection currently produces one `EventSmartDetect` envelope
with one descriptor. Event aggregation can be added later without coupling the
output plugin to camera-specific behavior.
