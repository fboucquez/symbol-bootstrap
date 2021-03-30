#!/bin/bash
set -e
symbol-bootstrap config -p testnet -a dual -t target/testnet-supernode -c test/supernode.yml --noPassword $1 $2 $3
