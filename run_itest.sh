#!/bin/bash

if [ ${TRAVIS_PULL_REQUEST} = "false" ] ||  [ -z ${TRAVIS_PULL_REQUEST} ];
then
  echo "Must be run from a PR."
  exit 0
fi

# launch Kiali in the background
yarn kiali &
APP_PID=$!

# wait for app
timeout 10s bash -c "until curl -I -L  --silent  --output /dev/null http://localhost:5003; do if [ "$?" -eq 0 ]; then continue; fi; sleep 1; done"

yarn itest

kill -9 ${APP_PID}

./take_test_screenshot.sh
