#!/bin/bash
sudo ./cmds/clean-all.sh
./bin/run config
./bin/run compose -u current
docker-compose -f target/docker/docker-compose.yml up --build peer-node-0 peer-node-1
