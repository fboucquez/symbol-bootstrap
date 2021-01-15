#!/bin/bash
set -e
symbol-bootstrap start -u current -p bootstrap -c test/optin_preset.yml --password 1234 -t target/bootstrap-optin $1
