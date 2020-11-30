#!/bin/bash
set -e

symbol-bootstrap start -p bootstrap -a services -t target/bootstrap $1 $2 $3
