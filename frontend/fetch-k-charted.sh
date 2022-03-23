#!/bin/bash

if [[ "$#" -lt 1 || "$1" = "--help" ]]; then
	echo "Syntax: $0 <PR URL or ID>"
	echo ""
	echo "Fetch and build a PR of K-Charted. E.g.:"
	echo "    $0 44"
	echo "    $0 https://github.com/kiali/k-charted/pull/44"
	echo "    $0 https://github.com/kiali/k-charted/pull/44#issuecomment-513183133"
	echo ""
	echo "This script removes the existing files in node_modules/@kiali/k-charted-pf4, replacing them with a custom build."
	echo ""
	echo "To restore the K-Charted version defined in package.json, run:"
	echo ""
	echo "    $0 --restore"
	echo ""
	exit
fi

if [[ "$1" = "--restore" ]]; then
	echo "Restoring @kiali/k-charted-pf4"
	yarn upgrade @kiali/k-charted-pf4
  exit
fi

# Destructure URL
IFS='#'
URL=( $1 )

IFS='/'
PARTS=( ${URL[0]} )

if [[ "${#PARTS[@]}" == "1" ]]; then
	ID="${PARTS[0]}"
elif [[ "${#PARTS[@]}" -ge "7" ]]; then
	ID="${PARTS[6]}"
else
	echo "Could not read parameter $1: URL or ID expected"
	exit
fi

echo "Pull request ID: $ID"

# Remove existing module & prepare
rm -rf node_modules/@kiali/k-charted-pf4
mkdir -p node_modules/@kiali/k-charted-pf4 && cd node_modules/@kiali

# Clone
git clone https://github.com/kiali/k-charted.git tmp
cd tmp

# Checkout PR
BRANCHNAME="pr-$ID"
git fetch origin pull/$ID/head:$BRANCHNAME
git checkout $BRANCHNAME

# Build & put eveything in place
make pf4build
mv web/pf4/dist ../k-charted-pf4
mv web/pf4/package.json ../k-charted-pf4

# Clean
cd ../../..
rm -rf node_modules/@kiali/tmp

bold=$(tput bold)
normal=$(tput sgr0)

echo ""
echo "The build for K-Charted PR $ID has been written in node_modules."
echo "${bold}To restore the K-Charted version defined in package.json, run \"$0 --restore\".${normal}"
