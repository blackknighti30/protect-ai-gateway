# Architecture

Protect AI Gateway owns a normalized event model. Camera vendors, detector implementations, and output protocols remain isolated behind plugins.

```text
+-------------------+       +-------------------+
|  Camera plugins   |       | Detector plugins  |
| Reolink / ONVIF   |       | Native / Frigate  |
+---------+---------+       +---------+---------+
          \                           /
           \                         /
            +-----------------------+
            | Normalized Detection  |
            +-----------+-----------+
                        |
              +---------+---------+
              | Gateway Event     |
              | Engine            |
              +---------+---------+
                        |
       +----------------+----------------+
       |                |                |
+------+-------+ +------+-------+ +------+-------+
| Protect      | | ONVIF        | | MQTT/Webhook |
| output       | | output       | | outputs      |
+--------------+ +--------------+ +--------------+
```

## Design rules

1. The gateway owns the normalized model, not any camera vendor.
2. Outputs do not depend on the source of a detection.
3. Plugins are replaceable and API-versioned.
4. Protocol captures become fixtures and regression tests.
5. Core lifecycle and deduplication logic belongs in the event engine.
