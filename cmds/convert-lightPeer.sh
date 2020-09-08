#!/bin/bash
set -e


./bin/run clean -t target/lightPeer
./bin/run config -p lightPeer  -t target/lightPeer
./bin/run compose -u current -r -t target/lightPeer --aws
#./bin/run run  -t target/lightPeer
docker compose convert  -c fboucquez_nem_ecs -f target/lightPeer/docker/docker-compose.yml
