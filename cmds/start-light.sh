#!/bin/bash
set -e

./bin/run start -p light -r  -u current -t target/light $1
