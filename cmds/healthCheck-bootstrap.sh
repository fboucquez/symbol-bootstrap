#!/bin/bash
set -e

# docker rm -f $(docker ps -aq)
symbol-bootstrap healthCheck -t target/bootstrap $1
