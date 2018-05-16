#!/bin/bash

: ${SCREENSHOT_REPO_TOKEN?"Need to set SCREENSHOT_REPO_TOKEN"}
: ${TRAVIS_BUILD_NUMBER?"Need to set TRAVIS_BUILD_NUMBER"}

if [ -z ${TRAVIS_PULL_REQUEST} ] || [ ${TRAVIS_PULL_REQUEST} = "false" ]; 
then
  echo "Missing env TRAVIS_PULL_REQUEST.  Must be run from a PR."
  exit 0
fi

# upload screenshot to github repo
# $1 path to screenshot image file
upload() {
  FILENAME=$1
  SCREENSHOT_CONTENT=$(base64 -w 0 ${FILENAME})
  DEST_FILE="travis-build-${TRAVIS_BUILD_NUMBER}.png"

  echo -n '{"message": "Screenshot", "content": "'${SCREENSHOT_CONTENT}'"}' | \
    curl --fail -L -H "Authorization: token ${SCREENSHOT_REPO_TOKEN}" -X PUT -d @- "https://api.github.com/repos/kiali-bot/travis-screenshots/contents/kiali-ui/${DEST_FILE}"
  return $?
}

# post a comment to the PR
# $1 comment text
comment() {
  COMMENT="$1 ![Kiali app screenshot](https://raw.githubusercontent.com/kiali-bot/travis-screenshots/master/kiali-ui/${DEST_FILE})"
  DEST_FILE="travis-build-${TRAVIS_BUILD_NUMBER}.png"
  curl --fail -L -H "Authorization: token ${SCREENSHOT_REPO_TOKEN}" -X POST -d '{"body": "'"${COMMENT}"'"}' "https://api.github.com/repos/kiali/kiali-ui/issues/${TRAVIS_PULL_REQUEST}/comments"
  return $?
}

SCREENSHOT_FILE1="kiali-browser-test.png"
if [ -f ${SCREENSHOT_FILE1} ]
then
  COMMENT="Screenshot for build ${TRAVIS_BUILD_NUMBER}"
  upload "${SCREENSHOT_FILE1}" && comment "${COMMENT}" || echo "Encountered Github API error."
else
  echo "Screenshot file doesn't exist"
fi

exit 0