`symbol-bootstrap supernode`
============================

It registers the nodes in the supernode rewards program by announcing the enrol transaction to the registration address.

* [`symbol-bootstrap supernode`](#symbol-bootstrap-supernode)

## `symbol-bootstrap supernode`

It registers the nodes in the supernode rewards program by announcing the enrol transaction to the registration address.

```
USAGE
  $ symbol-bootstrap supernode

OPTIONS
  -h, --help           It shows the help of this command.
  -t, --target=target  [default: target] The target folder where the symbol-bootstrap network is generated
  -u, --url=url        [default: http://localhost:3000] the network url
  --maxFee=maxFee      [default: 100000] the max fee used when announcing (absolute)

EXAMPLE
  $ symbol-bootstrap supernode
```

_See code: [src/commands/supernode.ts](https://github.com/nemtech/symbol-bootstrap/blob/v0.4.1/src/commands/supernode.ts)_
