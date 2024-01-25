#!/usr/bin/env bash
cd ..

YAML_FILES=$(git diff --staged --name-only HEAD --diff-filter=AM | grep -E '\.yml|\.yaml')
[ -z "$YAML_FILES" ] && exit 0

echo "Formatting staged YAML files:"
echo $YAML_FILES | tr " " "\n"

# Remove trailing whitespaces to avoid yaml formatter bug (https://github.com/google/yamlfmt/issues/153)
sed -i 's/[ \t]*$//' $YAML_FILES
yamlfmt $YAML_FILES
git add $YAML_FILES