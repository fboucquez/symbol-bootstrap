#!/bin/bash
set -e

# docker rm -f $(docker ps -aq)
symbol-bootstrap start -p bootstrap -r  -t target/bootstrap -a alpha $1 $2 $3
