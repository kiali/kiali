#!/bin/bash

# This is a helper script used when building the container image of Kaili.
# You should not run this file directly. It is invoked through the main
# Makefile when doing:
#   $ make container-build-kiali
#
# See the main Makefile for more info.

DIR=$(dirname $0)/..
CONSOLE_DIR=${CONSOLE_LOCAL_DIR:-$DIR/frontend}

mkdir -p $DIR/_output/docker

# Some sanity checks of CONSOLE_DIR. Some checks are naive.
if [ -z "$CONSOLE_DIR" ]; then
  echo "You must set the CONSOLE_LOCAL_DIR environment variable to the path where the UI source code is located."
  exit 1
elif [ ! -f "$CONSOLE_DIR/package.json" ]; then
  echo "CONSOLE_DIR is $CONSOLE_DIR"
  echo "Apparently, this CONSOLE_DIR does not contain the kiali UI"
  exit 1
elif [ ! -d "$CONSOLE_DIR/build" ] || [ -z "$(ls -A $CONSOLE_DIR/build)" ]; then
  echo "CONSOLE_DIR is $CONSOLE_DIR"
  echo "Apparently, the kiali UI is not built."
  echo "Build the front-end by running 'yarn && yarn build' inside the kiali UI directory"
  exit 1
fi

echo "Copying local console files from $CONSOLE_DIR"
rm -rf $DIR/_output/docker/console && mkdir $DIR/_output/docker/console
cp -r $CONSOLE_DIR/build/* $DIR/_output/docker/console
