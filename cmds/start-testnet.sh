#!/bin/bash
set -e

sudo ./cmds/clean-all.sh
./bin/run config -p testnet -a dual
./bin/run compose -u current
./bin/run run
