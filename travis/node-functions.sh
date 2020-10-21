#!/usr/bin/env bash
set -e

. ./travis/travis-functions.sh

node_load_version(){
  VERSION="$(npm run version --silent)"
  validate_env_variable "VERSION" "$FUNCNAME"
  echo -e "$VERSION"
}

npm_publish_alpha(){
  VERSION="$(node_load_version)"
  validate_env_variable "VERSION" "$FUNCNAME"
  validate_env_variable "NPM_TOKEN" "$FUNCNAME"
  NEW_VERSION="$VERSION-alpha-$(date +%Y%m%d%H%M)"
  echo "Uploading npm package version $NEW_VERSION"
  cp travis/.npmrc $HOME/.npmrc
  npm version "$NEW_VERSION" --commit-hooks false --git-tag-version false
  npm publish --tag alpha
}

node_push_github_pages(){
  npm run doc
  VERSION="$(node_load_version)"
  touch ./ts-docs/.nojekyll
  push_github_pages $VERSION 'ts-docs/'
}

node_release(){
  VERSION="$(node_load_version)"
  validate_env_variable "VERSION" "$FUNCNAME"
  validate_env_variable "RELEASE_BRANCH" "$FUNCNAME"
  validate_env_variable "REMOTE_NAME" "$FUNCNAME"
  validate_env_variable "POST_RELEASE_BRANCH" "$FUNCNAME"
  validate_env_variable "NPM_TOKEN" "$FUNCNAME"
  checkout_branch "${RELEASE_BRANCH}"


  cp travis/.npmrc $HOME/.npmrc
  if [ "$SKIP_RELEASE_PUBLISH" = "true" ]; then
    echo "Skipping publishing of sdk artifacts"
    echo ""
  else
    echo "Publishing $TRAVIS_REPO_SLUG artifacts"
    npm publish
    echo ""
  fi

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
}

if [ "$1" == "node_publish_alpha" ];then
    node_publish_alpha
fi

if [ "$1" == "node_release" ];then
    node_release
fi

if [ "$1" == "node_push_github_pages" ];then
    node_push_github_pages
fi

