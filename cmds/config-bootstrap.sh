#!/bin/bash
set -e

# docker rm -f $(docker ps -aq)
symbol-bootstrap config -p bootstrap -t target/bootstrap $1
