`symbol-bootstrap healthCheck`
==============================

It checks if the services created with docker compose are up and running.

This command checks:
- Whether the docker containers are running.
- Whether the services' exposed ports are listening.
- Whether the rest gateways' /node/health are OK.

The health check process handles 'repeat' and custom 'openPort' services.

Although it's highly possible your node is connected to the internet, this is an OFFLINE command as it health checks the local nodes and services.

* [`symbol-bootstrap healthCheck`](#symbol-bootstrap-healthcheck)

## `symbol-bootstrap healthCheck`

It checks if the services created with docker compose are up and running.

```
USAGE
  $ symbol-bootstrap healthCheck

OPTIONS
  -h, --help           It shows the help of this command.
  -t, --target=target  [default: target] The target folder where the symbol-bootstrap network is generated

DESCRIPTION
  This command checks:
  - Whether the docker containers are running.
  - Whether the services' exposed ports are listening.
  - Whether the rest gateways' /node/health are OK.

  The health check process handles 'repeat' and custom 'openPort' services.

  Although it's highly possible your node is connected to the internet, this is an OFFLINE command as it health checks 
  the local nodes and services.

EXAMPLE
  $ symbol-bootstrap healthCheck
```

_See code: [src/commands/healthCheck.ts](https://github.com/nemtech/symbol-bootstrap/blob/v0.4.5/src/commands/healthCheck.ts)_
