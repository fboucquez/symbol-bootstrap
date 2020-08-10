#!/bin/bash
set -e

rootDir="$(dirname "$(realpath $0)")/.."
rm -rf "${rootDir}/target/data"
echo "data folder removed"
