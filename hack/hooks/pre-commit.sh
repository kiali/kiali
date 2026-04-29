#!/usr/bin/env bash

# Unset GIT_DIR to avoid issues when git gui sets it to a relative path
unset GIT_DIR

# Change to the repo root directory regardless of where this script is invoked from
cd "$(git rev-parse --show-toplevel)" || exit 1

if ! which yamlfmt &> /dev/null; then
  echo "You do not have yamlfmt - installing it now."
  if ! which go &> /dev/null; then
    echo "You do not have 'go' in your PATH - please install it. Aborting."
    exit 1
  fi
  go install github.com/google/yamlfmt/cmd/yamlfmt@latest
fi

if ! which goimports &> /dev/null; then
  echo "You do not have goimports - installing it now."
  if ! which go &> /dev/null; then
    echo "You do not have 'go' in your PATH - please install it. Aborting."
    exit 1
  fi
  go install golang.org/x/tools/cmd/goimports@latest
fi

#### GO Formatting ####
go_files=()
while IFS= read -r f; do
  go_files+=("$f")
done < <(git diff --cached --name-only --diff-filter=AM | grep '\.go$' | grep -v '^vendor')

if [ "${#go_files[@]}" -gt 0 ]; then
  echo "Formatting staged GO files with gofmt..."
  gofmt -w "${go_files[@]}"

  echo "Fixing imports with goimports..."
  for gofile in "${go_files[@]}"; do
    # Remove empty lines in import blocks (same logic as fix_imports.sh)
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
    ' "$gofile"
    goimports -w -local "github.com/kiali/kiali" "$gofile"
  done

  # Check if formatting changed any files
  go_unformatted=$(git diff --name-only "${go_files[@]}")
fi

#### YAML Formatting ####
yaml_files=()
while IFS= read -r f; do
  yaml_files+=("$f")
done < <(git diff --cached --name-only HEAD --diff-filter=AM | grep -E '\.yml|\.yaml' | grep -v istio-crds | grep -v hack/offline/must-gather-test-data)

if [ "${#yaml_files[@]}" -gt 0 ]; then
  yaml_unformatted=()
  while IFS= read -r f; do
    yaml_unformatted+=("$f")
  done < <(yamlfmt -dry -quiet "${yaml_files[@]}" 2>&1 | sed 's/^.*://')
fi

if [ "${#yaml_unformatted[@]}" -gt 0 ]; then
  echo "Formatting staged YAML files:"
  printf '%s\n' "${yaml_unformatted[@]}"

  # Remove trailing whitespaces to avoid yaml formatter bug (https://github.com/google/yamlfmt/issues/153)
  sed -i 's/[ \t]*$//' "${yaml_unformatted[@]}"
  yamlfmt "${yaml_unformatted[@]}"
fi

#### Shell script checks ####
shellcheck_cmd=(shellcheck)
if ! which shellcheck &> /dev/null; then
  if which npx &> /dev/null; then
    echo "shellcheck not found in PATH - using npx shellcheck@4.1.0."
    shellcheck_cmd=(npx --yes shellcheck@4.1.0)
  else
    echo "You do not have shellcheck in your PATH."
    echo "Install it via your package manager (e.g. 'brew install shellcheck', 'apt install shellcheck', 'dnf install ShellCheck')"
    echo "or ensure 'npx' is available as a fallback, then retry."
    exit 1
  fi
fi

hack_shell_scripts=()
while IFS= read -r -d '' f; do
  hack_shell_scripts+=("$f")
done < <(git diff --cached --name-only -z --diff-filter=ACMR -- 'hack/*.sh' 'hack/**/*.sh')

if [ "${#hack_shell_scripts[@]}" -gt 0 ]; then
  echo "Running shellcheck for hack scripts..."
  if ! "${shellcheck_cmd[@]}" -S warning -x "${hack_shell_scripts[@]}"; then
    echo "shellcheck reported issues in hack scripts - the git commit is aborted."
    exit 1
  fi
fi

#### I18N missing statements ####
cd frontend || exit 1

yarn i18n

i18n_files=$(git diff --name-only --diff-filter=M | grep -E 'translation.json')

#### Git commit check ####
if [ "${#yaml_unformatted[@]}" -gt 0 ] || [ -n "$go_unformatted" ]; then
  echo "Some files have been formatted - the git commit is aborted."
  echo "Please stage the formatted files and commit again."
  exit 1
fi

if [ -n "$i18n_files" ]; then
  echo "New i18n statements are generated but not committed - the git commit is aborted. Please include the updated translation files in the commit."
  exit 1
fi
