#!/bin/bash
set -e -x
rm -rf backup-sync/testnet-backup
mkdir -p backup-sync/testnet-backup/data
cp -rf target/testnet-dual/nodes/api-node/data/0* backup-sync/testnet-backup/data
cp -rf target/testnet-dual/nodes/api-node/data/proof.index.dat backup-sync/testnet-backup/data
cp -rf target/testnet-dual/nodes/api-node/data/index.dat backup-sync/testnet-backup/data
rm -rf backup-sync/testnet-backup/data/spool
touch backup-sync/testnet-backup/data/server.lock # force docker compose to run a recover

cd backup-sync/testnet-backup
zip -r testnet-local-minimal-backup.zip *
cd ../..
