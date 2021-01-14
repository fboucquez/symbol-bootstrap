#!/bin/bash
set -e
symbol-bootstrap start -p testnet -a dual -t target/testnet-dual -c  test/testnet-custom-preset.yml $1 $2 $3
