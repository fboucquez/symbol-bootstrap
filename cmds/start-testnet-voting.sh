#!/bin/bash
set -e
symbol-bootstrap start -p testnet -a dual -t target/testnet-voting -c test/voting_preset.yml  $1
