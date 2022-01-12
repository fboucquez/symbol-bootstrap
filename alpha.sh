#!/usr/bin/env bash
set -e
VERSION="$(npm run version --silent)"
TAG=${1:-alpha}
echo "publishing $VERSION with tag $TAG"
npm pack
NEW_VERSION="$VERSION-$TAG-$(date +%Y%m%d%H%M)"
npm version "$NEW_VERSION" --commit-hooks false --git-tag-version false
npm publish --tag alpha
npm version "$VERSION" --commit-hooks false --git-tag-version false
npm run style:fix
