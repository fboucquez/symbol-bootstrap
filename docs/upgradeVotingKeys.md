`symbol-bootstrap upgradeVotingKeys`
====================================

It upgrades the voting keys and files when required.

Voting file upgrade:
- If the node's current voting file has an end epoch close to the current epoch ("close to expiring") this command creates a new 'private_key_treeX.dat' that continues the current file.
- "Close to expiring" happens when the epoch is in the upper half of the voting file. If the file's epoch length is 720, close to expiring will be 360+.
- The current finalization epoch that defines if the file is close to expiration can be passed as parameter. Otherwise, bootstrap will try to resolve it from the network.

When a new voting file is created, bootstrap will advise running the link command again.

* [`symbol-bootstrap upgradeVotingKeys`](#symbol-bootstrap-upgradevotingkeys)

## `symbol-bootstrap upgradeVotingKeys`

It upgrades the voting keys and files when required.

```
USAGE
  $ symbol-bootstrap upgradeVotingKeys

OPTIONS
  -h, --help                             It shows the help of this command.

  -t, --target=target                    [default: target] The target folder where the symbol-bootstrap network is
                                         generated

  -u, --user=user                        [default: current] User used to run docker images when creating the the voting
                                         key files. "current" means the current user.

  --finalizationEpoch=finalizationEpoch  The network's finalization epoch. It can be retrieved from the /chain/info rest
                                         endpoint. If not provided, the bootstrap known epoch is used.

DESCRIPTION
  Voting file upgrade:
  - If the node's current voting file has an end epoch close to the current epoch ("close to expiring") this command 
  creates a new 'private_key_treeX.dat' that continues the current file.
  - "Close to expiring" happens when the epoch is in the upper half of the voting file. If the file's epoch length is 
  720, close to expiring will be 360+.
  - The current finalization epoch that defines if the file is close to expiration can be passed as parameter. 
  Otherwise, bootstrap will try to resolve it from the network.

  When a new voting file is created, bootstrap will advise running the link command again.

EXAMPLE
  $ symbol-bootstrap upgradeVotingKeys
```

_See code: [src/commands/upgradeVotingKeys.ts](https://github.com/nemtech/symbol-bootstrap/blob/v1.0.6/src/commands/upgradeVotingKeys.ts)_
