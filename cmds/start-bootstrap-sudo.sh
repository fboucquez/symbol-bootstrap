#!/bin/bash
set -e

symbol-bootstrap start -p bootstrap -r  -u '' -t target/bootstrap $1 $2 $3
