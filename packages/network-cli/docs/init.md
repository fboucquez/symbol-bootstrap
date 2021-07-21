`symbol-network init`
=====================

This command is the first step configuring the node cluster for an existing an network or a new network.

It's prompt style wizard that asks a series of questions to start defining your nodes. The output of this command is a file containing a list of node types you want to create.

This is a "one time" command that will kick the network setup process. Please follow the instructions on the screen.

This commands creates the initial 'network-input.yml' and 'custom-network-preset.yml' files.

* [`symbol-network init`](#symbol-network-init)

## `symbol-network init`

This command is the first step configuring the node cluster for an existing an network or a new network.

```
USAGE
  $ symbol-network init

OPTIONS
  -h, --help           It shows the help of this command.

  --noPassword         When provided, the tool will not use a password, so private keys will be stored in plain text.
                       Use with caution.

  --password=password  MASTER PASSWORD: A password used to encrypt and decrypt the local key store. This cli prompts for
                       a password by default, can be provided in the command line (--password=XXXX) or disabled in the
                       command line (--noPassword).

  --ready              if --read is provided, the won't ask for confirmations

  --showPrivateKeys    if --showPrivateKeys is provided, private keys will be displayed

DESCRIPTION
  It's prompt style wizard that asks a series of questions to start defining your nodes. The output of this command is a 
  file containing a list of node types you want to create.

  This is a "one time" command that will kick the network setup process. Please follow the instructions on the screen.

  This commands creates the initial 'network-input.yml' and 'custom-network-preset.yml' files.

EXAMPLE
  $ symbol-network init
```
