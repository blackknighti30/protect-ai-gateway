# Protect secure transport

The Protect transport connects to Device Service using an mTLS WebSocket:

- TCP port: `7442`
- path: `/camera/1.0/ws`
- WebSocket subprotocol: `secure_transfer`
- payloads: UTF-8 JSON text frames

The transport is deliberately separate from the Protect output plugin. The
plugin maps normalized detections to `EventSmartDetect` envelopes; the transport
only authenticates, upgrades the connection, frames messages and handles
WebSocket control frames.

## Configuration

```js
const { ProtectTransport } = require('./src/transports/protect');

const transport = new ProtectTransport({
    host: '192.168.1.10',
    port: 7442,
    certPath: '/config/protect/client.crt',
    keyPath: '/config/protect/client.key',
    caPath: '/config/protect/ca.crt'
});
```

`cert`, `key` and `ca` may also be supplied as PEM buffers. Certificate
provisioning and AI Port registration are intentionally outside this patch.
The connection therefore requires credentials already accepted by Protect.

Certificate verification is enabled by default. `rejectUnauthorized: false`
exists for protocol research only and should not be used in production.

## Current boundary

This implementation provides the observed secure WebSocket channel and sends
JSON envelopes. Registration, identity negotiation, heartbeat messages and
reconnection policy remain separate milestones because their exact live message
sequence must be validated against a Protect controller.
