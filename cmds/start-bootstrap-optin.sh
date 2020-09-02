#!/bin/bash
set -e

sudo ./cmds/clean-all.sh
./bin/run start -u current -p bootstrap -c test/optin_preset.yml -t target/bootstrap-optin
