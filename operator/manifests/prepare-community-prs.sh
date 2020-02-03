#!/bin/bash

################################################
# This script prepares two branches in the
# community operator git repo. You can create
# PRs based on the branches this script creates.
# This prepares OLM metadata for both upstream
# and community Kiali operator.
################################################

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
DEFAULT_GIT_REPO=${SCRIPT_DIR}/../../../../../../../../community-operators
GIT_REPO=${DEFAULT_GIT_REPO}

while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -gr|--git-repo)
      GIT_REPO="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
$0 [option...]

Valid options:
  -gr|--git-repo <directory>
      The directory where the local community-operators git repo is located.
      This is the location where you git cloned the repo https://github.com/operator-framework/community-operators
      The default assumes it is located next to the Kiali git repo's go structure. In other words, the default is:
      ${DEFAULT_GIT_REPO}
      which resolves to:
      $(readlink -f ${DEFAULT_GIT_REPO} || echo '<git repo does not exist at the default location>')
HELPMSG
      exit 1
      ;;
    *)
      echo "Unknown argument [$key].  Aborting."
      exit 1
      ;;
  esac
done

# Validate some things before trying to do anything

if [ ! -d "${GIT_REPO}" ]; then
  echo "You must specify a valid community-operators git repo: ${GIT_REPO}"
  exit 1
fi

COMMUNITY_MANIFEST_DIR="${SCRIPT_DIR}/kiali-community"
UPSTREAM_MANIFEST_DIR="${SCRIPT_DIR}/kiali-upstream"

if [ ! -d "${COMMUNITY_MANIFEST_DIR}" ]; then
  echo "Did not find the community manifest directory: ${COMMUNITY_MANIFEST_DIR}"
  exit 1
fi
if [ ! -d "${UPSTREAM_MANIFEST_DIR}" ]; then
  echo "Did not find the upstream manifest directory: ${UPSTREAM_MANIFEST_DIR}"
  exit 1
fi

# Create branches in the community git repo

DATETIME_NOW="$(date --utc +'%F-%H-%M-%S')"
GIT_REPO_COMMUNITY_BRANCH_NAME="kiali-community-${DATETIME_NOW}"
GIT_REPO_UPSTREAM_BRANCH_NAME="kiali-upstream-${DATETIME_NOW}"

cd ${GIT_REPO}
git fetch origin --verbose

git checkout -b ${GIT_REPO_COMMUNITY_BRANCH_NAME} origin/master
cp -R ${COMMUNITY_MANIFEST_DIR}/* ${GIT_REPO}/community-operators/kiali
git add -A
git commit --signoff -m '[kiali] [community] update kiali'

git checkout -b ${GIT_REPO_UPSTREAM_BRANCH_NAME} origin/master
cp -R ${UPSTREAM_MANIFEST_DIR}/* ${GIT_REPO}/upstream-community-operators/kiali
git add -A
git commit --signoff -m '[kiali] [upstream] update kiali'

# Completed!
echo "New Kiali metadata has been added to two new branches in the community git repo."
echo "Create two PRs based on these two branches:"
echo "1. git push <your git remote name> ${GIT_REPO_COMMUNITY_BRANCH_NAME}"
echo "2. git push <your git remote name> ${GIT_REPO_UPSTREAM_BRANCH_NAME}"
echo "These branches are located in the git repo: ${GIT_REPO}"
