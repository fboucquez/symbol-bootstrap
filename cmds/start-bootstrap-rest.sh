#!/bin/bash
set -e

# docker rm -f $(docker ps -aq)
#./bin/run start -p bootstrap -r  -u current -t target/bootstrap $1

docker-compose up --remove-orphans --build -f target/bootstrap/docker/docker-compose.yml
