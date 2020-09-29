`symbol-bootstrap link`
=======================

It calls a running server announcing all the node transactions like VRF and Voting. This command is useful to link the nodes keys to an existing running network like testnet.

* [`symbol-bootstrap link`](#symbol-bootstrap-link)

## `symbol-bootstrap link`

It calls a running server announcing all the node transactions like VRF and Voting. This command is useful to link the nodes keys to an existing running network like testnet.

```
USAGE
  $ symbol-bootstrap link

OPTIONS
  -h, --help           It shows the help of this command.
  -t, --target=target  [default: target] the target folder
  -u, --url=url        [default: http://localhost:3000] the network url
  --maxFee=maxFee      [default: 100000] the max fee used when announcing

EXAMPLE
  $ symbol-bootstrap link
```

_See code: [src/commands/link.ts](https://github.com/nemtech/symbol-bootstrap/blob/v0.1.1/src/commands/link.ts)_
