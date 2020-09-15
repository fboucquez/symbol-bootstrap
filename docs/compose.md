`symbol-bootstrap compose`
==========================

It generates the docker-compose.yml file from the configured network.

* [`symbol-bootstrap compose`](#symbol-bootstrap-compose)

## `symbol-bootstrap compose`

It generates the docker-compose.yml file from the configured network.

```
USAGE
  $ symbol-bootstrap compose

OPTIONS
  -h, --help           It shows the help of this command.
  -r, --reset          It resets the configuration generating a new one
  -t, --target=target  [default: target] the target folder

  -u, --user=user      [default: current] User used to run the services in the docker-compose.yml file. "current" means
                       the current user.

EXAMPLE
  $ symbol-bootstrap compose
```

_See code: [src/commands/compose.ts](https://github.com/nemtech/symbol-bootstrap/blob/v0.0.0/src/commands/compose.ts)_
