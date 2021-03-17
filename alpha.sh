#!/usr/bin/env bash
set -e
. ./travis/node-functions.sh
VERSION="$(node_load_version)"
echo $VERSION
npm pack && /bin/bash travis/node-functions.sh node_publish_alpha
npm version "$VERSION" --commit-hooks false --git-tag-version false
npm run style:fix
