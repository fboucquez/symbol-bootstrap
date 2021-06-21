`symbol-network link`
=====================

It announces VRF and Voting Link transactions for all the nodes to the network for each node with 'Peer' or 'Voting' roles. This command finalizes the node registration to an existing network.

* [`symbol-network link`](#symbol-network-link)

## `symbol-network link`

It announces VRF and Voting Link transactions for all the nodes to the network for each node with 'Peer' or 'Voting' roles. This command finalizes the node registration to an existing network.

```
USAGE
  $ symbol-network link

OPTIONS
  -h, --help                   It shows the help of this command.

  --maxFee=maxFee              the max fee used when announcing (absolute). The node min multiplier will be used if it
                               is not provided.

  --noNodePassword             When provided, the tool will not use a password, so private keys will be stored in plain
                               text. Use with caution.

  --noPassword                 When provided, the tool will not use a password, so private keys will be stored in plain
                               text. Use with caution.

  --nodePassword=nodePassword  NODE PASSWORD: A password used to encrypt and decrypt each node configuration (Inside the
                               nodes folder).

  --password=password          MASTER PASSWORD: A password used to encrypt and decrypt the local key store. This cli
                               prompts for a password by default, can be provided in the command line (--password=XXXX)
                               or disabled in the command line (--noPassword).

  --ready                      If --ready is provided, the command will not ask for confirmation when announcing
                               transactions.

  --unlink                     Perform "Unlink" transactions unlinking the voting and VRF keys from the node signer
                               account from all the nodes

EXAMPLES
  $ symbol-network link
  $ echo "$MY_ENV_VAR_PASSWORD" | symbol-network link --unlink
```
