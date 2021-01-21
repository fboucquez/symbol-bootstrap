#!/bin/bash
set -e
symbol-bootstrap start -p testnet -a peer -c test/non-harvesting-peer.yml -t target/testnet-peer $1 $2 $3
