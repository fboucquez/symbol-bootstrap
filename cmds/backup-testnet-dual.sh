#!/bin/bash
set -e
symbol-bootstrap backup -t target/testnet-dual --destinationFile ./backup-sync/testnet-local-backup.zip $1 $2 $3
