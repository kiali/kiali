#!/bin/bash

# This is a helper script used when building the docker image of Kaili.
# You should not run this file directly. It is invoked through the main
# Makefile when doing:
#   $ make docker-build
#
# See the main Makefile for more info.

DIR=$(dirname $0)/..
VERSION=${CONSOLE_VERSION:-latest}
CONSOLE_DIR=${CONSOLE_LOCAL_DIR:-$DIR/../../../../../kiali-ui}

mkdir -p $DIR/_output/docker
if [ "$VERSION" = "local" ]; then
  echo "Copying local console files from $CONSOLE_DIR"
  rm -rf $DIR/_output/docker/console && mkdir $DIR/_output/docker/console
  cp -r $CONSOLE_DIR/build/* $DIR/_output/docker/console

  # If there is a version.txt file, use it (required for continuous delivery)
  if [ ! -f "$DIR/_output/docker/console/version.txt" ]; then
    # If jq command is available, don't do a trip to the web
    if  ! type "jq" > /dev/null 2>&1 ; then
      echo "$(npm -C $CONSOLE_DIR view $CONSOLE_DIR version)-local-$(cd $CONSOLE_DIR; git rev-parse HEAD)" > $DIR/_output/docker/console/version.txt
    else
      echo "$(jq -r '.version' $CONSOLE_DIR/package.json)-local-$(cd $CONSOLE_DIR; git rev-parse HEAD)" > $DIR/_output/docker/console/version.txt
    fi
  fi
else
  if [ ! -d "$DIR/_output/docker/console" ]; then
    echo "Downloading console ($VERSION)..."
    mkdir $DIR/_output/docker/console || exit 1
    curl -s $(npm view @kiali/kiali-ui@$VERSION dist.tarball) \
        | tar zxf - --strip-components=2 --directory $DIR/_output/docker/console package/build || exit 1
    echo "$(npm view @kiali/kiali-ui@$VERSION version)" > \
        $DIR/_output/docker/console/version.txt || exit 1
  fi
fi

echo "Console version being packaged: $(cat $DIR/_output/docker/console/version.txt)"
