#!/bin/bash
set -e

# docker rm -f $(docker ps -aq)
symbol-bootstrap start -p bootstrap -u current -t target/bootstrap $1 $2 $3
