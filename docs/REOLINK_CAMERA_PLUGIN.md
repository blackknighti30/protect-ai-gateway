# Reolink camera plugin

The Reolink camera plugin is the first hardware producer for Protect AI Gateway.
It uses Reolink's HTTP CGI API for authenticated motion, AI-state, and snapshot
access and publishes camera-neutral detections through `CameraContext`.

## Configuration

```js
{
  host: '192.168.1.99',
  port: 80,
  username: 'admin',
  password: 'secret',
  channel: 0,
  events: {
    sourceToken: 'wide',
    pollIntervalMs: 1000,
    aiPollIntervalMs: 1000,
    aiEnabled: true
  }
}
```

The plugin deliberately contains no Protect or ONVIF behavior. PTZ is deferred
to a separate SDK-level controller so the first integration remains focused on
detection and snapshot production.
