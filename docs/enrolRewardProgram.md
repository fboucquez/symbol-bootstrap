`symbol-bootstrap enrolRewardProgram`
=====================================

It enrols the nodes in the rewards program by announcing the enrol transaction to the registration address. Currently, the only program that can be enrolled post-launch is 'SuperNode'.

* [`symbol-bootstrap enrolRewardProgram`](#symbol-bootstrap-enrolrewardprogram)

## `symbol-bootstrap enrolRewardProgram`

It enrols the nodes in the rewards program by announcing the enrol transaction to the registration address. Currently, the only program that can be enrolled post-launch is 'SuperNode'.

```
USAGE
  $ symbol-bootstrap enrolRewardProgram

OPTIONS
  -h, --help              It shows the help of this command.
  -t, --target=target     [default: target] The target folder where the symbol-bootstrap network is generated
  -u, --url=url           [default: http://localhost:3000] the network url

  --maxFee=maxFee         the max fee used when announcing (absolute). The node min multiplier will be used if it is not
                          provided.

  --useKnownRestGateways  Use the best NEM node available when announcing. Otherwise the command will use the node
                          provided by the --url parameter.

EXAMPLE
  $ symbol-bootstrap enrolRewardProgram
```

_See code: [src/commands/enrolRewardProgram.ts](https://github.com/nemtech/symbol-bootstrap/blob/v0.4.3/src/commands/enrolRewardProgram.ts)_
