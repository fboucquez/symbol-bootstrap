`symbol-bootstrap verify`
=========================

It tests the installed software in the current computer reporting if there is any missing dependency, invalid version, or software related issue.

* [`symbol-bootstrap verify`](#symbol-bootstrap-verify)

## `symbol-bootstrap verify`

It tests the installed software in the current computer reporting if there is any missing dependency, invalid version, or software related issue.

```
USAGE
  $ symbol-bootstrap verify

OPTIONS
  -h, --help       It shows the help of this command.

  --logger=logger  [default: Console,File] The loggers the command will use. Options are: Console,File,Silent. Use ','
                   to select multiple loggers.

EXAMPLE
  $ symbol-bootstrap verify
```

_See code: [src/commands/verify.ts](https://github.com/fboucquez/symbol-bootstrap/blob/v1.1.3/src/commands/verify.ts)_
