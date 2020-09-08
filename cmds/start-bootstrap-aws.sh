#!/bin/bash
set -e

./bin/run clean -t target/bootstrap
./bin/run config -p bootstrap  -t target/bootstrap
./bin/run compose -u current -r -t target/bootstrap --aws
