#!/bin/bash
set -e
symbol-bootstrap start -u current -p bootstrap -c test/optin_preset.yml -t target/bootstrap-optin $1 $2 $3
