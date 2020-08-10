#!/bin/bash
set -e

# docker rm -f $(docker ps -aq)
sudo ./cmds/clean-all.sh
./bin/run config -p bootstrap
./bin/run compose -u current
./bin/run run
