#!/bin/bash
set -e
rm -rf testnet-backup
mkdir -p testnet-backup
cp -rf target/databases/db testnet-backup/mongo
cp -rf target/nodes/api-node/data testnet-backup/data
rm -rf testnet-backup/data/spool

cd testnet-backup
zip -r testnet-full-backup.zip *
cd ..

# push testnet-backup/testnet-full-backup.zip into S3
