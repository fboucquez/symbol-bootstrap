`symbol-network expandNodes`
============================

This "one-time" command is the second step configuring the node cluster for an existing an network or a new network.

After running the 'init' command and you have revisited the 'network-input.yml' files, you can run this command to convert the list of node types to the final list of nodes you want to create saved in the initial 'network.yml' file.

* [`symbol-network expandNodes`](#symbol-network-expandnodes)

## `symbol-network expandNodes`

This "one-time" command is the second step configuring the node cluster for an existing an network or a new network.

```
USAGE
  $ symbol-network expandNodes

OPTIONS
  -h, --help           It shows the help of this command.

  --noPassword         When provided, the tool will not use a password, so private keys will be stored in plain text.
                       Use with caution.

  --password=password  MASTER PASSWORD: A password used to encrypt and decrypt the local key store. This cli prompts for
                       a password by default, can be provided in the command line (--password=XXXX) or disabled in the
                       command line (--noPassword).

DESCRIPTION
  After running the 'init' command and you have revisited the 'network-input.yml' files, you can run this command to 
  convert the list of node types to the final list of nodes you want to create saved in the initial 'network.yml' file.

EXAMPLE
  $ symbol-network expandNodes
```
