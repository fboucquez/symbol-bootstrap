`symbol-bootstrap start`
========================

Single command that aggregates config, compose and run in one liner!

* [`symbol-bootstrap start`](#symbol-bootstrap-start)

## `symbol-bootstrap start`

Single command that aggregates config, compose and run in one liner!

```
USAGE
  $ symbol-bootstrap start

OPTIONS
  -a, --assembly=assembly                 An optional assembly type, example "dual" for testnet
  -b, --build                             If provided, docker-compose will run with -b (--build)

  -c, --customPreset=customPreset         External preset file. Values in this file will override the provided presets
                                          (optional)

  -d, --daemon                            If provided, docker-compose will run with -d (--detached) and this command
                                          will wait unit server is running before returning

  -h, --help                              It shows the help of this command.

  -p, --preset=(bootstrap|testnet|light)  [default: bootstrap] the network preset

  -r, --reset                             It resets the configuration generating a new one

  -t, --target=target                     [default: target] the target folder

  -t, --timeout=timeout                   [default: 60000] If running in daemon mode, how long before timing out (in MS)

  -u, --user=user                         [default: current] User used to run docker images when creating configuration
                                          files like certificates or nemesis block. "current" means the current user.

EXAMPLES
  $ symbol-bootstrap start
  $ symbol-bootstrap start -p bootstrap
  $ symbol-bootstrap start -p testnet -a dual
```

_See code: [src/commands/start.ts](https://github.com/nemtech/symbol-bootstrap/blob/v0.1.0/src/commands/start.ts)_
