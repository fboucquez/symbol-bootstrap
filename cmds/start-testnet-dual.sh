#!/bin/bash
set -e
#rm -rf target/testnet-dual/databases/db
#mkdir -p target/testnet-dual/databases/db
#rm -rf target/testnet-dual/nodes/api-node/data/recovery.lock
#rm -rf target/testnet-dual/nodes/api-node/data/broker.started
#rm -rf target/testnet-dual/nodes/api-node/logs
#mkdir -p target/testnet-dual/nodes/api-node/logs
#
##rm -rf target/testnet-dual/nodes/api-node/data
##cp target/data target/testnet-dual/nodes/api-node  -r
#
#rm -rf target/testnet-dual/nodes/api-node/data/state
#rm -rf target/testnet-dual/nodes/api-node/data/statedb

symbol-bootstrap start -p testnet -a dual -t target/testnet-dual -c  test/testnet-custom-preset.yml $1 $2 $3
