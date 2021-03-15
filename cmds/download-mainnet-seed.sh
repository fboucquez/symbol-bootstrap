#!/bin/bash
set -e

username=$1
password=$2
zipCrypto=$3

wget --http-user=$1 --http-password=$2  -O nemesis.7z http://nijuichi.nem.ninja/nemesis.7z

rm -rf privateSeeds
7z x nemesis.7z "-p$3"
mv nemesis privateSeeds
mv resources ./privateSeeds


cd privateSeeds
zip -r ./seed.zip ./seed
cd ..
rm -rf ../symbol-node-registration-cli/mainnet/seed
rm -rf ../symbol-node-registration-cli/mainnet/resources

cp -r ./privateSeeds/* ../symbol-node-registration-cli/mainnet
