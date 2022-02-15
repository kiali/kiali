#!/bin/bash

# This is a helper script used when building the container image of Kaili.
# You should not run this file directly. It is invoked through the main
# Makefile when doing:
#   $ make container-build-kiali
#
# See the main Makefile for more info.

DIR=$(dirname $0)/..
CONSOLE_DIR=${CONSOLE_LOCAL_DIR:-$DIR/../kiali-ui}

mkdir -p $DIR/_output/docker

# Some sanity checks of CONSOLE_DIR. Some checks are naive.
if [ -z "$CONSOLE_DIR" ]; then
  echo "You must set the CONSOLE_LOCAL_DIR environment variable to the path where the kiali-ui source code is located."
  echo "If you don't have the kiali-ui source code, download it from the kiali/kiali-ui GitHub repository."
  exit 1
elif [ ! -f "$CONSOLE_DIR/package.json" ]; then
  echo "CONSOLE_DIR is $CONSOLE_DIR"
  echo "Apparently, this CONSOLE_DIR does not contain the kiali-ui"
  exit 1
elif [ ! -d "$CONSOLE_DIR/build" ] || [ -z "$(ls -A $CONSOLE_DIR/build)" ]; then
  echo "CONSOLE_DIR is $CONSOLE_DIR"
  echo "Apparently, the kiali-ui is not built."
  echo "Build the front-end by running 'yarn && yarn build' inside the kiali-ui directory"
  exit 1
fi

echo "Copying local console files from $CONSOLE_DIR"
rm -rf $DIR/_output/docker/console && mkdir $DIR/_output/docker/console
cp -r $CONSOLE_DIR/build/* $DIR/_output/docker/console

# If there is a version.txt file, use it (required for continuous delivery)
if [ ! -f "$DIR/_output/docker/console/version.txt" ]; then
  echo "$(sed -n 's/.*"version":.*"\(.*\)".*/\1/p' $CONSOLE_DIR/package.json)-local-$(cd $CONSOLE_DIR; git rev-parse HEAD)" > $DIR/_output/docker/console/version.txt
fi

echo "Console version being packaged: $(cat $DIR/_output/docker/console/version.txt)"
