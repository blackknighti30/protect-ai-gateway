# Protect AI Gateway

> Turn third-party IP cameras into first-class UniFi Protect devices.

Protect AI Gateway is a plugin-based middleware platform for ingesting camera and detector events, normalizing detections, and publishing them through outputs such as UniFi Protect, ONVIF, MQTT, and webhooks.

## Project status

The project is in early development. The initial repository contains the proven protocol, detection, and plugin foundations extracted from the original `rtsp-to-onvif` research project.

## Architecture

```text
Camera plugins       Detector plugins
      \                    /
       \                  /
        Normalized detections
                 |
          Gateway event engine
                 |
     +-----------+-----------+
     |           |           |
  Protect      ONVIF       MQTT/Webhooks
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Development

```bash
npm install
npm test
```

`main` should remain releasable: changes are developed in focused branches and merged only with a passing test suite.
