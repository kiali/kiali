#!/usr/bin/env bash
cd ..

if ! which yamlfmt &> /dev/null; then
  echo "You do not have yamlfmt - installing it now."
  if ! which go &> /dev/null; then
    echo "You do not have 'go' in your PATH - please install it. Aborting."
    exit 1
  fi
  go install github.com/google/yamlfmt/cmd/yamlfmt@latest
fi

#### GO Formatting ####
go_files=$(git diff --staged --name-only --diff-filter=AM | grep '\.go$' | grep -v '^vendor')

if [ -n "$go_files" ]; then
  go_unformatted=$(gofmt -l $go_files)
fi

if [ -n "$go_unformatted" ]; then
  echo "Formatting staged GO files:"
  gofmt -w $go_unformatted
  echo $go_unformatted | tr " " "\n"
fi

#### YAML Formatting ####
yaml_files=$(git diff --staged --name-only HEAD --diff-filter=AM | grep -E '\.yml|\.yaml')

if [ -n "$yaml_files" ]; then
  yaml_unformatted=$(yamlfmt -dry -quiet $yaml_files 2>&1 | sed 's/^.*://')
fi

if [ -n "$yaml_unformatted" ]; then
  echo "Formatting staged YAML files:"
  echo $yaml_unformatted | tr " " "\n"

  # Remove trailing whitespaces to avoid yaml formatter bug (https://github.com/google/yamlfmt/issues/153)
  sed -i 's/[ \t]*$//' $yaml_unformatted
  yamlfmt $yaml_unformatted
fi

#### Git commit check ####
if [ -n "$yaml_unformatted" ] || [ -n "$go_unformatted" ]; then
  echo "Some files have been formatted - the git commit is aborted."
  exit 1
fi
