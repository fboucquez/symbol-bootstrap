#!/bin/bash
set -e
rm -rf backup-sync/testnet-backup
mkdir -p backup-sync/testnet-backup
cp -rf target/testnet-dual/databases/db backup-sync/testnet-backup/mongo
cp -rf target/testnet-dual/nodes/api-node/data backup-sync/testnet-backup/data
rm -rf backup-sync/testnet-backup/data/spool

cd backup-sync/testnet-backup
zip -r testnet-local-full-backup.zip *
cd ../..
