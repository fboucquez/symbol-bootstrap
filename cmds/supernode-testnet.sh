#!/bin/bash
set -e
symbol-bootstrap supernode -t target/testnet-dual  -u http://api-01.eu-west-1.0.10.0.x.symboldev.network:3000  $1 $2 $3
