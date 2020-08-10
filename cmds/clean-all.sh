#!/bin/bash
set -e

rootDir="$(dirname "$(realpath $0)")/.."
rm -rf "${rootDir}/target"
echo "target folder removed"
