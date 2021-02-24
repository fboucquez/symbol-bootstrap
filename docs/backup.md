`symbol-bootstrap backup`
=========================

The command backs up the Mongo and RocksDb data folder into a Zip file that can then be used by the `--backupSync` feature. Bootstrap compose services must be stopped before calling this command.

Note: This command is designed for NGL to be used when running public main or public test networks. It's not backing up any node specific information.

* [`symbol-bootstrap backup`](#symbol-bootstrap-backup)

## `symbol-bootstrap backup`

The command backs up the Mongo and RocksDb data folder into a Zip file that can then be used by the `--backupSync` feature. Bootstrap compose services must be stopped before calling this command.

```
USAGE
  $ symbol-bootstrap backup

OPTIONS
  -h, --help                         It shows the help of this command.
  -t, --target=target                [default: target] The target folder where the symbol-bootstrap network is generated

  --destinationFile=destinationFile  The file location where the backup zip file will be created. Default destination is
                                     target/backup.zip.

  --[no-]fullBackup                  If the restore/backup to be performed is a full backup (RocksDB + Mongo) or partial
                                     backup (RocksDB + Catapult's Importer)

  --nodeName=nodeName                The dual/api node name to be used to backup the data. If not provided, the first
                                     configured api/dual node would be used.

DESCRIPTION
  Note: This command is designed for NGL to be used when running public main or public test networks. It's not backing 
  up any node specific information.

EXAMPLE
  $ symbol-bootstrap backup
```

_See code: [src/commands/backup.ts](https://github.com/nemtech/symbol-bootstrap/blob/v0.4.4/src/commands/backup.ts)_
