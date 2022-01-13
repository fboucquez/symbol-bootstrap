`symbol-bootstrap resetData`
============================

It removes the data keeping the generated configuration, certificates, keys and block 1.

* [`symbol-bootstrap resetData`](#symbol-bootstrap-resetdata)

## `symbol-bootstrap resetData`

It removes the data keeping the generated configuration, certificates, keys and block 1.

```
USAGE
  $ symbol-bootstrap resetData

OPTIONS
  -h, --help           It shows the help of this command.
  -t, --target=target  [default: target] The target folder where the symbol-bootstrap network is generated

  --logger=logger      [default: Console,File] The loggers the command will use. Options are: Console,File,Silent. Use
                       ',' to select multiple loggers.

EXAMPLE
  $ symbol-bootstrap resetData
```

_See code: [src/commands/resetData.ts](https://github.com/fboucquez/symbol-bootstrap/blob/v1.1.3/src/commands/resetData.ts)_
