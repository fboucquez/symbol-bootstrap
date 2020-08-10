#!/bin/bash
set -e

sudo ./cmds/clean-all.sh

docker run \
--user "$(id -u):$(id -g)" \
-i alpine \
ls -la
