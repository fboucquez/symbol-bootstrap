#!/bin/bash
set -e

# docker rm -f $(docker ps -aq)
./bin/run start -p bootstrap -r  -t target/bootstrap -a alpha
