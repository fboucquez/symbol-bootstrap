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
  -h, --help              It shows the help of this command.
  -t, --target=target     [default: target] The target folder where the symbol-bootstrap network is generated
  -u, --url=url           [default: http://localhost:3000] the network url

  --maxFee=maxFee         the max fee used when announcing (absolute). The node min multiplier will be used if it is not
                          provided.

  --noPassword            When provided, Bootstrap will not use a password, so private keys will be stored in plain
                          text. Use with caution.

  --password=password     A password used to encrypt and decrypted custom presets, addresses.yml, and preset.yml files.
                          When providing a password, private keys would be encrypted. Keep this password in a secure
                          place!

  --ready                 If --ready is provided, the command will not ask for confirmation when announcing
                          transactions.

  --unlink                Perform "Unlink" transactions unlinking the voting and VRF keys from the node signer account

  --useKnownRestGateways  Use the best NEM node available when announcing. Otherwise the command will use the node
                          provided by the --url parameter.

EXAMPLE
  $ symbol-bootstrap link
```

_See code: [src/commands/link.ts](https://github.com/nemtech/symbol-bootstrap/blob/v0.4.4/src/commands/link.ts)_
