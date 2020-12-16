#!/bin/bash
set -e

symbol-bootstrap start -p bootstrap -a supernode -t target/bootstrap-supernode $1 $2 $3
