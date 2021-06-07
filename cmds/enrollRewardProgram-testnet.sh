#!/bin/bash
set -e
symbol-bootstrap enrollRewardProgram -t target/testnet-supernode --maxFee 1000000 --useKnownRestGateways --password 1111 $1 $2 $3
