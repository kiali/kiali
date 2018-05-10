#!/bin/bash

: ${SCREENSHOT_REPO_TOKEN?"Need to set SCREENSHOT_REPO_TOKEN"}
: ${TRAVIS_BUILD_NUMBER?"Need to set TRAVIS_BUILD_NUMBER"}

if [ -z ${TRAVIS_PULL_REQUEST} ] || [ ${TRAVIS_PULL_REQUEST} = "false" ]; 
then
  echo "Missing env TRAVIS_PULL_REQUEST.  Must be run from a PR."
  exit 0
fi
if [ -f "kiali-browser-test.png" ]
then
  SCREENSHOT_CONTENT=$(base64 -w 0 kiali-browser-test.png)
  DEST_FILE="travis-build-${TRAVIS_BUILD_NUMBER}.png"

  # upload screenshot to a repo
  curl -s -H "Authorization: token ${SCREENSHOT_REPO_TOKEN}" -X PUT -d '{"message": "Test upload1", "content": "'${SCREENSHOT_CONTENT}'"}' "https://api.github.com/repos/kiali-bot/travis-screenshots/contents/kiali-ui/${DEST_FILE}"

  # post a comment to PR
  COMMENT="Screenshot for build ${TRAVIS_BUILD_NUMBER} ![Kiali app screenshot](https://raw.githubusercontent.com/kiali-bot/travis-screenshots/master/kiali-ui/${DEST_FILE})"
  curl -s -H "Authorization: token ${SCREENSHOT_REPO_TOKEN}" -X POST -d '{"body": "'"${COMMENT}"'"}' "https://api.github.com/repos/kiali/kiali-ui/issues/${TRAVIS_PULL_REQUEST}/comments"
else
  echo "Screenshot file doesn't exist"
fi

exit 0