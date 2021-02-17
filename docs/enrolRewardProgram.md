`symbol-bootstrap enrolRewardProgram`
=====================================

It enrols the nodes in the rewards program by announcing the enrol transaction to the registration address.  You can also use this command to update the program registration when you change the node public key or server host.

Currently, the only program that can be enrolled post-launch is 'SuperNode'.

* [`symbol-bootstrap enrolRewardProgram`](#symbol-bootstrap-enrolrewardprogram)

## `symbol-bootstrap enrolRewardProgram`

It enrols the nodes in the rewards program by announcing the enrol transaction to the registration address.  You can also use this command to update the program registration when you change the node public key or server host.

```
USAGE
  $ symbol-bootstrap enrolRewardProgram

OPTIONS
  -h, --help              It shows the help of this command.
  -t, --target=target     [default: target] The target folder where the symbol-bootstrap network is generated
  -u, --url=url           [default: http://localhost:3000] the network url

  --maxFee=maxFee         the max fee used when announcing (absolute). The node min multiplier will be used if it is not
                          provided.

  --ready                 If --ready is provided, the command will not ask for confirmation when announcing
                          transactions.

  --useKnownRestGateways  Use the best NEM node available when announcing. Otherwise the command will use the node
                          provided by the --url parameter.

DESCRIPTION
  Currently, the only program that can be enrolled post-launch is 'SuperNode'.

EXAMPLE
  $ symbol-bootstrap enrolRewardProgram
```

_See code: [src/commands/enrolRewardProgram.ts](https://github.com/nemtech/symbol-bootstrap/blob/v0.4.4/src/commands/enrolRewardProgram.ts)_
