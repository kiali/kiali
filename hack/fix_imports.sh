#!/bin/bash

FILES=`find . -path './vendor' -prune -o -type f -iname '*.go' -print`

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
