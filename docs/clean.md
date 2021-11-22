`symbol-bootstrap clean`
========================

It removes the target folder deleting the generated configuration and data

* [`symbol-bootstrap clean`](#symbol-bootstrap-clean)

## `symbol-bootstrap clean`

It removes the target folder deleting the generated configuration and data

```
USAGE
  $ symbol-bootstrap clean

OPTIONS
  -h, --help           It shows the help of this command.
  -t, --target=target  [default: target] The target folder where the symbol-bootstrap network is generated

  --logger=logger      [default: ConsoleLog,File] The loggers the command will use. Options are:
                       Console,ConsoleLog,File,Silent. Use ',' to select multiple loggers.

EXAMPLE
  $ symbol-bootstrap clean
```

_See code: [src/commands/clean.ts](https://github.com/nemtech/symbol-bootstrap/blob/v1.1.2/src/commands/clean.ts)_
