#!/bin/bash

if ! which goimports &> /dev/null; then
  echo "You do not have goimports - installing it now."
  if ! which go &> /dev/null; then
    echo "You do not have 'go' in your PATH - please install it. Aborting."
    exit 1
  fi
  go install golang.org/x/tools/cmd/goimports@latest
fi

FILES=`find . -path './vendor' -prune -o -path './frontend' -prune -o -type f -iname '*.go' -print`

for gofile in $FILES; do
  awk -i inplace '
  {
    if ($0 == "import (") {
      in_imports = 1
      print $0
    }
    else if (in_imports == 1) {
      if ($0 == ")") {
        in_imports = 0
        print $0
      }
      else if ($0 != "") {
        print $0
      }
    }
    else {
      print $0
    }
  }
  ' $gofile
  goimports -w -local "github.com/kiali/kiali" $gofile
done
