#!/bin/bash
set -e
echo "Some nice urls"
echo "Rest http://localhost:3000/node/storage"
echo "Rest http://localhost:3000/accounts"
echo "Wallet http://localhost"
echo "Explorer http://localhost:90"

symbol-bootstrap config -p mainnet -a api -t target/mainnet-demo -c test/mainnet_demo_preset.yml --noPassword -r
symbol-bootstrap start -p mainnet -a api -t target/mainnet-demo -c test/mainnet_demo_preset_no_main_private_key.yml --upgrade --noPassword
