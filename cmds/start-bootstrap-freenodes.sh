#!/bin/bash
set -e

symbol-bootstrap start --reset --preset bootstrap --customPreset ./test/freenodes_preset.yml --user current -t target/bootstrap-freenodes
