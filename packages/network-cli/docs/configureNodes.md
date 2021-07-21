`symbol-network configureNodes`
===============================

This is the last step of the node cluster setup that generates and updates each node's configuration.

Each node defined in the "network.yml" file will have it's own symbol-bootstrap "target" folder. Each folder can be then be deployed into the final node boxes like in AWS.

This command can be executed multiple times if you need to update or upgrade your nodes. Then you can redeploy the configuration in the final the node boxes.

* [`symbol-network configureNodes`](#symbol-network-configurenodes)

## `symbol-network configureNodes`

This is the last step of the node cluster setup that generates and updates each node's configuration.

```
USAGE
  $ symbol-network configureNodes

OPTIONS
  -h, --help                   It shows the help of this command.

  --noNodePassword             When provided, the tool will not use a password, so private keys will be stored in plain
                               text. Use with caution.

  --noPassword                 When provided, the tool will not use a password, so private keys will be stored in plain
                               text. Use with caution.

  --nodePassword=nodePassword  NODE PASSWORD: A password used to encrypt and decrypt each node configuration (Inside the
                               nodes folder).

  --offline                    Use --offline If you are creating the nodes for the first time and there is information
                               to be updated from the current running network.

  --password=password          MASTER PASSWORD: A password used to encrypt and decrypt the local key store. This cli
                               prompts for a password by default, can be provided in the command line (--password=XXXX)
                               or disabled in the command line (--noPassword).

DESCRIPTION
  Each node defined in the "network.yml" file will have it's own symbol-bootstrap "target" folder. Each folder can be 
  then be deployed into the final node boxes like in AWS.

  This command can be executed multiple times if you need to update or upgrade your nodes. Then you can redeploy the 
  configuration in the final the node boxes.

EXAMPLE
  $ symbol-network configureNodes
```
