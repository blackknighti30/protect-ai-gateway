# Protect AI Gateway architecture

The gateway is intentionally split into camera-specific inputs, a normalized
internal detection model, and protocol-specific outputs.

```text
camera adapter -> normalized detections -> event engine -> output adapter
```

A camera adapter must not construct UniFi Protect messages directly. It emits
normalized detections containing a camera identifier, tracker identifier,
object type, lifecycle state, confidence, bounding box, timestamp and optional
attributes. Output adapters translate that model into their target protocol.

## Initial Protect protocol finding

Captured AI Port traffic connects to Device Service on TCP 7442 using an mTLS
WebSocket at `/camera/1.0/ws` with the `secure_transfer` subprotocol. Smart
Detect messages use a JSON envelope whose `function_name` is
`EventSmartDetect`.

The first implementation milestone is deliberately offline:

1. Parse captured `EventSmartDetect` envelopes.
2. Convert descriptors into normalized detections.
3. Rebuild the observed envelope shape deterministically.
4. Add live transport, adoption and certificate handling separately.

Keeping transport separate prevents certificate and WebSocket work from being
mixed with event semantics and gives plugin authors a stable SDK target.

## Plugin boundaries

Planned plugin families are:

- camera adapters for streams, snapshots, PTZ and vendor-native events;
- detection providers for external inference systems;
- enrichment providers for faces, plates and object attributes;
- output adapters for Protect, ONVIF, MQTT and webhooks.

Community plugins should eventually run outside the main gateway process and
communicate through a versioned local API. That allows independent upgrades and
keeps a failed third-party plugin from interrupting every camera.
