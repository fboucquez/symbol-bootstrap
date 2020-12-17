#!/usr/bin/env bash
set -e

. ./travis/node-functions.sh
VERSION="$(node_load_version)"
log_env_variables
#npm test
#npm pack
#
#npm run doc
#touch ./ts-docs/.nojekyll

RELEASE_BRANCH=main
POST_RELEASE_BRANCH=main
TRAVIS_REPO_SLUG=nemtech/symbol-bootstrap
#push_github_pages $VERSION 'ts-docs/'

#node_push_github_pages
#npm publish

git tag -fa "v$VERSION" -m "Releasing version $VERSION"
echo "Increasing artifact version"
npm version patch -m "Increasing version to %s" --git-tag-version false

NEW_VERSION=$(npm run version --silent)
echo "New Version"
echo "$NEW_VERSION"
echo ""
git add .
git commit -m "Creating new version $NEW_VERSION"

echo "Pushing code to $REMOTE_NAME $POST_RELEASE_BRANCH"
git push --set-upstream $REMOTE_NAME $RELEASE_BRANCH:$POST_RELEASE_BRANCH
echo "Pushing tags to $REMOTE_NAME"
git push --tags $REMOTE_NAME

