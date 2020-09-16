#!/bin/bash
set -e

# docker rm -f $(docker ps -aq)
./bin/run start -p bootstrap -r  -u '' -t target/bootstrap $1
