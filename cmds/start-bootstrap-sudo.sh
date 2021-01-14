#!/bin/bash
set -e

symbol-bootstrap start -p bootstrap -r  -u '' -t target/bootstrap --password 1234 $1
