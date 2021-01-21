#!/bin/bash
set -e
echo "Some nice urls"
echo "Rest http://localhost:3000/node/storage"
echo "Rest http://localhost:3000/accounts"
echo "Wallet http://localhost"
echo "Explorer http://localhost:90"
symbol-bootstrap start -p mainnet -a demo -t target/mainnet-demo -c test/mainnet_demo_preset.yml $1 $2 $3
