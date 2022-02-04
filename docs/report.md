`symbol-bootstrap report`
=========================

it generates reStructuredText (.rst) reports describing the configuration of each node.

* [`symbol-bootstrap report`](#symbol-bootstrap-report)

## `symbol-bootstrap report`

it generates reStructuredText (.rst) reports describing the configuration of each node.

```
USAGE
  $ symbol-bootstrap report

OPTIONS
  -h, --help           It shows the help of this command.
  -t, --target=target  [default: target] The target folder where the symbol-bootstrap network is generated

  --logger=logger      [default: Console,File] The loggers the command will use. Options are: Console,File,Silent. Use
                       ',' to select multiple loggers.

EXAMPLE
  $ symbol-bootstrap report
```

_See code: [src/commands/report.ts](https://github.com/fboucquez/symbol-bootstrap/blob/v1.1.5/src/commands/report.ts)_
