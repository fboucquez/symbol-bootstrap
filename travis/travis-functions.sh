#!/usr/bin/env bash
set -e

REMOTE_NAME="origin"
FUNCTIONS_VERSION="0.1.2"

test_travis_functions ()
{
  echo "Travis Functions Loaded"
}

increment_version ()
{
  declare -a part=( ${1//\./ } )
  declare    new
  declare -i carry=1

  for (( CNTR=${#part[@]}-1; CNTR>=0; CNTR-=1 )); do
    len=${#part[CNTR]}
    new=$((part[CNTR]+carry))
    [ ${#new} -gt $len ] && carry=1 || carry=0
    [ $CNTR -gt 0 ] && part[CNTR]=${new: -len} || part[CNTR]=${new}
  done
  new="${part[*]}"
  echo -e "${new// /.}"
}

log_env_variables(){
  echo "DEV_BRANCH = $DEV_BRANCH"
  echo "POST_RELEASE_BRANCH = $POST_RELEASE_BRANCH"
  echo "RELEASE_BRANCH = $RELEASE_BRANCH"
  echo "REMOTE_NAME = $REMOTE_NAME"
  echo "DOCKER_IMAGE_NAME = $DOCKER_IMAGE_NAME"
  echo "TRAVIS_EVENT_TYPE = $TRAVIS_EVENT_TYPE"
  echo "TRAVIS_COMMIT_MESSAGE = $TRAVIS_COMMIT_MESSAGE"
  echo "TRAVIS_REPO_SLUG = $TRAVIS_REPO_SLUG"
  echo "TRAVIS_BRANCH = $TRAVIS_BRANCH"
  echo "TRAVIS_TAG = $TRAVIS_TAG"
  echo "FUNCTIONS_VERSION = $FUNCTIONS_VERSION"
  echo "VERSION = $VERSION"
}


validate_env_variables(){
  log_env_variables
  validate_env_variable "TRAVIS_EVENT_TYPE" "$FUNCNAME"
  validate_env_variable "RELEASE_BRANCH" "$FUNCNAME"
  validate_env_variable "POST_RELEASE_BRANCH" "$FUNCNAME"
  validate_env_variable "DEV_BRANCH" "$FUNCNAME"
  validate_env_variable "TRAVIS_COMMIT_MESSAGE" "$FUNCNAME"
}

resolve_operation ()
{
  OPERATION="build"
  if [[ ("$TRAVIS_COMMIT_MESSAGE" == "release" ||  "$DEV_BRANCH" != "$RELEASE_BRANCH" ) && "$TRAVIS_EVENT_TYPE" != "pull_request"  && "$TRAVIS_BRANCH" == "$RELEASE_BRANCH" ]];
   then
     OPERATION="release"
   else
       if [ "$TRAVIS_EVENT_TYPE" != "pull_request" ] && [ "$TRAVIS_BRANCH" == "$DEV_BRANCH" ];
     then
       OPERATION="publish"
    fi
  fi
  echo -e "$OPERATION"
}

validate_env_variable ()
{
  var="$1"
  if [ "${!var}" = "" ]
    then
      echo "Env $var has not been provided for operation '$2'"
      exit 128
  fi
}

assert_value ()
{
  value="$1"
  expectedValue="$2"
  if [ "$value" != "$expectedValue" ]
    then
      echo "'$value' is not the expected value '$expectedValue'"
      exit 128
  fi
}



checkout_branch ()
{
  CHECKOUT_BRANCH="$1"
  validate_env_variable "TRAVIS_REPO_SLUG" "$FUNCNAME"
  validate_env_variable "CHECKOUT_BRANCH" "$FUNCNAME"
  validate_env_variable "GITHUB_TOKEN" "$FUNCNAME"
  validate_env_variable "REMOTE_NAME" "$FUNCNAME"
  git remote rm $REMOTE_NAME
  echo "Setting remote url https://github.com/${TRAVIS_REPO_SLUG}.git"
  git remote add $REMOTE_NAME "https://${GITHUB_TOKEN}@github.com/${TRAVIS_REPO_SLUG}.git" >/dev/null 2>&1
  echo "Checking out $CHECKOUT_BRANCH as travis leaves the head detached."
  git checkout $CHECKOUT_BRANCH
}

load_version_from_file(){
  VERSION="$(head -n 1 version.txt)"
  echo -e "$VERSION"
}

post_release_version_file(){

  validate_env_variable "RELEASE_BRANCH" "$FUNCNAME"
  validate_env_variable "REMOTE_NAME" "$FUNCNAME"
  validate_env_variable "POST_RELEASE_BRANCH" "$FUNCNAME"
  checkout_branch "${RELEASE_BRANCH}"
  VERSION="$(load_version_from_file)"

  NEW_VERSION=$(increment_version "$VERSION")

  echo "Version: $VERSION"
  echo "New Version: $NEW_VERSION"

  echo "Creating tag version v$VERSION"
  git tag -fa "v$VERSION" -m "Releasing version $VERSION"

  echo "Creating new version $NEW_VERSION"
  echo "$NEW_VERSION" > 'version.txt'
  git add version.txt
  git commit -m "Creating new version $NEW_VERSION"

  echo "Pushing code to $REMOTE_NAME $POST_RELEASE_BRANCH"
  git push $REMOTE_NAME $RELEASE_BRANCH:$POST_RELEASE_BRANCH
  echo "Pushing tags to $REMOTE_NAME"
  git push --tags $REMOTE_NAME

}


push_github_pages(){

  VERSION="$1"
  DOCS_PATH="$2"
  PUBLICATION_BRANCH=gh-pages
  REPO_PATH=$PWD

  validate_env_variable "VERSION" "$FUNCNAME"
  validate_env_variable "PUBLICATION_BRANCH" "$FUNCNAME"
  validate_env_variable "DOCS_PATH" "$FUNCNAME"
  validate_env_variable "GITHUB_TOKEN" "$FUNCNAME"
  validate_env_variable "TRAVIS_REPO_SLUG" "$FUNCNAME"
  validate_env_variable "REPO_PATH" "$FUNCNAME"

  # Checkout the branch
  rm -rf $HOME/publish
  cd $HOME
  git clone --branch=$PUBLICATION_BRANCH    https://${GITHUB_TOKEN}@github.com/$TRAVIS_REPO_SLUG publish 2>&1 > /dev/null
  cd publish
  # Update pages

  cp -r $REPO_PATH/${DOCS_PATH}. ./
  # Commit and push latest version
  git add .
  git config user.name  "Travis"
  git config user.email "travis@travis-ci.org"
  git diff-index --quiet HEAD || git commit -m "Uploading $VERSION docs."
  git push -fq origin $PUBLICATION_BRANCH 2>&1 > /dev/null
  cd $REPO_PATH

}

if [ "$1" == "post_release_version_file" ];then
    post_release_version_file
fi



