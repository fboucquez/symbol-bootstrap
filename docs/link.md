`symbol-bootstrap link`
=======================

It announces VRF and Voting Link transactions to the network for each node with 'Peer' or 'Voting' roles. This command finalizes the node registration to an existing network.

* [`symbol-bootstrap link`](#symbol-bootstrap-link)

## `symbol-bootstrap link`

It announces VRF and Voting Link transactions to the network for each node with 'Peer' or 'Voting' roles. This command finalizes the node registration to an existing network.

```
USAGE
  $ symbol-bootstrap link

OPTIONS
  -h, --help           It shows the help of this command.
  -t, --target=target  [default: target] The target folder where the symbol-bootstrap network is generated
  -u, --url=url        [default: http://localhost:3000] the network url
  --maxFee=maxFee      [default: 100000] the max fee used when announcing (absolute)
  --unlink             Perform "Unlink" transactions unlinking the voting and VRF keys from the node signer account

EXAMPLE
  $ symbol-bootstrap link
```

_See code: [src/commands/link.ts](https://github.com/nemtech/symbol-bootstrap/blob/v0.4.1/src/commands/link.ts)_
