#!/bin/bash
set -e
symbol-bootstrap config -p testnet -a dual -t target/testnet-supernode -c test/supernode.yml -r --password 1111  $1 $2 $3
symbol-bootstrap start --password 1111 --upgrade  -t target/testnet-supernode
