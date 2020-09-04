#!/bin/bash
set -e

# docker rm -f $(docker ps -aq)
./bin/run stop -t target/bootstrap
