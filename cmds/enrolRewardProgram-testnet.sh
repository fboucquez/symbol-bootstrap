#!/bin/bash
set -e
symbol-bootstrap enrolRewardProgram -t target/testnet-supernode  -u http://api-01.ap-northeast-1.testnet.symboldev.network:3000  $1 $2 $3
