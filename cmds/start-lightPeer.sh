#!/bin/bash
set -e

# docker rm -f $(docker ps -aq)
#./bin/run clean -t target/lightPeer
#./bin/run config -p lightPeer  -t target/lightPeer
./bin/run compose -u current -r -t target/lightPeer --aws
#./bin/run run  -t target/lightPeer

#./bin/run start -p lightPeer -r  -u current -t target/lightPeer $1
