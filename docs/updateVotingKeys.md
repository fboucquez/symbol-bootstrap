`symbol-bootstrap updateVotingKeys`
===================================

It updates the voting keys and files when required.

Voting file update:
- If the node's current voting file has an end epoch close to the current epoch ("close to expiring") this command creates a new 'private_key_treeX.dat' that continues the current file.
- By default, "Close to expiring" happens the voting file in the . By default, bootstrap will allow creating new files once the current file reaches its last month.
- The current finalization epoch that defines if the file is close to expiration can be passed as parameter. Otherwise, bootstrap will try to resolve it from the network.

When a new voting file is created, bootstrap will advise running the link command again.

* [`symbol-bootstrap updateVotingKeys`](#symbol-bootstrap-updatevotingkeys)

## `symbol-bootstrap updateVotingKeys`

It updates the voting keys and files when required.

```
USAGE
  $ symbol-bootstrap updateVotingKeys

OPTIONS
  -h, --help                             It shows the help of this command.

  -t, --target=target                    [default: target] The target folder where the symbol-bootstrap network is
                                         generated

  -u, --user=user                        [default: current] User used to run docker images when creating the the voting
                                         key files. "current" means the current user.

  --finalizationEpoch=finalizationEpoch  The network's finalization epoch. It can be retrieved from the /chain/info rest
                                         endpoint. If not provided, the bootstrap known epoch is used.

DESCRIPTION
  Voting file update:
  - If the node's current voting file has an end epoch close to the current epoch ("close to expiring") this command 
  creates a new 'private_key_treeX.dat' that continues the current file.
  - By default, "Close to expiring" happens the voting file in the . By default, bootstrap will allow creating new files 
  once the current file reaches its last month.
  - The current finalization epoch that defines if the file is close to expiration can be passed as parameter. 
  Otherwise, bootstrap will try to resolve it from the network.

  When a new voting file is created, bootstrap will advise running the link command again.

EXAMPLE
  $ symbol-bootstrap updateVotingKeys
```

_See code: [src/commands/updateVotingKeys.ts](https://github.com/nemtech/symbol-bootstrap/blob/v1.0.7/src/commands/updateVotingKeys.ts)_
