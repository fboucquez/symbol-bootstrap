`symbol-bootstrap config`
=========================

Command used to set up the configuration files and the nemesis block for the current network

* [`symbol-bootstrap config`](#symbol-bootstrap-config)

## `symbol-bootstrap config`

Command used to set up the configuration files and the nemesis block for the current network

```
USAGE
  $ symbol-bootstrap config

OPTIONS
  -a, --assembly=assembly                 An optional assembly type, example "dual" for testnet

  -c, --customPreset=customPreset         External preset file. Values in this file will override the provided presets
                                          (optional)

  -h, --help                              It shows the help of this command.

  -p, --preset=(bootstrap|testnet|light)  [default: bootstrap] the network preset

  -r, --reset                             It resets the configuration generating a new one

  -t, --target=target                     [default: target] the target folder

EXAMPLE
  $ symbol-bootstrap config -p bootstrap
```

_See code: [src/commands/config.ts](https://github.com/nemtech/symbol-bootstrap/blob/v0.0.0/src/commands/config.ts)_
