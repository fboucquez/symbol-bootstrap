#!/bin/bash
set -e

sudo ./cmds/clean-all.sh
./bin/run config -p bootstrap -c test/optin_preset.yml
./bin/run compose -u current
./bin/run run
