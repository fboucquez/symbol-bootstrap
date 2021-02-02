`symbol-bootstrap enrolSupernode`
=================================

It enrols the nodes in the supernode rewards program by announcing the enrol transaction to the registration address.

* [`symbol-bootstrap enrolSupernode`](#symbol-bootstrap-enrolsupernode)

## `symbol-bootstrap enrolSupernode`

It enrols the nodes in the supernode rewards program by announcing the enrol transaction to the registration address.

```
USAGE
  $ symbol-bootstrap enrolSupernode

OPTIONS
  -h, --help              It shows the help of this command.
  -t, --target=target     [default: target] The target folder where the symbol-bootstrap network is generated
  -u, --url=url           [default: http://localhost:3000] the network url

  --maxFee=maxFee         the max fee used when announcing (absolute). The node min multiplier will be used if it is not
                          provided.

  --useKnownRestGateways  Use the best NEM node available when announcing. Otherwise the command will use the node
                          provided by the --url parameter.

EXAMPLE
  $ symbol-bootstrap enrolSupernode
```

_See code: [src/commands/enrolSupernode.ts](https://github.com/nemtech/symbol-bootstrap/blob/v0.4.2/src/commands/enrolSupernode.ts)_
