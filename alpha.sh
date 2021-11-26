#!/usr/bin/env bash
set -e
. ./travis/node-functions.sh
VERSION="$(node_load_version)"
TAG=${1:-alpha}
echo "publishing $VERSION with tag $TAG"
npm pack
/bin/bash travis/node-functions.sh node_publish_alpha $TAG
npm version "$VERSION" --commit-hooks false --git-tag-version false
npm run style:fix
