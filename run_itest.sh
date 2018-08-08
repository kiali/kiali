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
mkdir -p itest_img

echo "Getting labels of https://api.github.com/repos/kiali/kiali-ui/pulls/${TRAVIS_PULL_REQUEST}"

RAW_DATA=$(curl -s https://api.github.com/repos/kiali/kiali-ui/pulls/${TRAVIS_PULL_REQUEST})
IFS=',' read -r -a labels <<< $(python2 getLabels.py "${RAW_DATA}")
for label in "${labels[@]}"
do
    yarn itest -t "${label}"
done

kill -9 ${APP_PID}
