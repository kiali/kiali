#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
OPERATOR_COURIER_VERIFY="true"

while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -ki|--kiali-image)
      KIALI_IMAGE="$2"
      shift;shift
      ;;
    -nm|--new-manifest)
      NEW_MANIFEST="$(echo ${2} | tr -d '/')"
      shift;shift
      ;;
    -nv|--new-version)
      NEW_VERSION="$2"
      shift;shift
      ;;
    -oi|--operator-image)
      OPERATOR_IMAGE="$2"
      shift;shift
      ;;
    -om|--old-manifest)
      OLD_MANIFEST="$(echo ${2} | tr -d '/')"
      shift;shift
      ;;
    -ov|--old-version)
      OLD_VERSION="$2"
      shift;shift
      ;;
    -pn|--package-name)
      NEW_PACKAGE_NAME="$2"
      shift;shift
      ;;
    -rv|--replace-version)
      REPLACE_VERSION="$2"
      shift;shift
      ;;
    -vm|--verify-manifest)
      OPERATOR_COURIER_VERIFY="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
$0 [option...]

Valid options:
  -ki|--kiali-image <repository image specifier>
      If you plan on deploying the Kiali image in a different repository and/or with a different version tag
      then set the kiali image specifier with this option. If not set, the existing image specifier will be used
      except its version tag will be changed to the --new-version string.
  -nm|--new-manifest <dir name>
      The name of the directory to contain the new manifest bundle files.
      If not specified, it will reuse the current manifest directory (--old-manifest).
      This is a relative name (not a path) and must be located in the same directory where this script lives.
      Default: the same value as specified by --old-manifest
  -nv|--new-version <version string>
      The new version that is going to be released. New manifest files for this version will be created.
  -oi|--operator-image <repository image specifier>
      If you plan on deploying the Kiali operator image in a different repository and/or with a different version tag
      then set the operator image specifier with this option. If not set, the existing image specifier will be used
      except its version tag will be changed to the --new-version string.
  -om|--old-manifest <dir name>
      The name of the existing directory containing the current manifest files.
      This is a relative name (not a path) and must be located in the same directory where this script lives.
  -ov|--old-version <version string>
      The old version that is going to be superceded with the new release. This must be the previous release
      prior to the new version. For example, if there is already versions 1.0 and 1.1 and the new version is
      2.0, the old version to be specified must be 1.1.
  -pn|--package-name <name>
      If specified, this will be the new manifest package name.
      If not specified, the current package name of the old manifest is retained.
      This setting is completely ignored unless --new-manifest is specified and is different from the --old-manifest.
  -rv|--replace-version <version string>
      The version that is going to be superceded with the new release. This must be the previous release
      prior to the new version. For example, if versions 1.0 and 1.1 have been released (into the wild, not just
      built) and the new version is 2.0, the replace version must be 1.1.
      Default: the same value as specified by --old-version
  -vm|--verify-manifest <true|false>
      Verify the validity of the manifest metadata via the operator-courier tool. You must have operator-courier
      installed and in your PATH for this to work.
      Default: true
HELPMSG
      exit 1
      ;;
    *)
      echo "Unknown argument [$key].  Aborting."
      exit 1
      ;;
  esac
done

# Validate some things before trying to do anything

if [ ! -d "${SCRIPT_DIR}/${OLD_MANIFEST:-!notvalid!}" ]; then
  echo "You must specify a valid old manifest directory located in ${SCRIPT_DIR}"
  exit 1
fi

if [ -z "${NEW_VERSION}" ]; then
  echo "You must specify a new version."
  exit 1
fi

if [ -z "${OLD_VERSION}" ]; then
  echo "You must specify an old version."
  exit 1
fi

if [ "${OPERATOR_COURIER_VERIFY}" == "true" ]; then
  if ! which operator-courier > /dev/null 2>&1 ; then
    echo "You do not have operator-courier in your PATH."
    echo "To install it, run: pip3 install operator-courier"
    echo "For more details, see: https://github.com/operator-framework/operator-courier#installation"
    echo "To disable this check, use the '--verify-manifest=false' option."
    exit 1
  fi
fi

NEW_MANIFEST=${NEW_MANIFEST:-${OLD_MANIFEST}}
OLD_MANIFEST_DIR="${SCRIPT_DIR}/${OLD_MANIFEST}"
NEW_MANIFEST_DIR="${SCRIPT_DIR}/${NEW_MANIFEST}"
OLD_VERSION_OLD_MANIFEST_DIR="${OLD_MANIFEST_DIR}/${OLD_VERSION}"
NEW_VERSION_OLD_MANIFEST_DIR="${OLD_MANIFEST_DIR}/${NEW_VERSION}"
OLD_VERSION_NEW_MANIFEST_DIR="${NEW_MANIFEST_DIR}/${OLD_VERSION}"
NEW_VERSION_NEW_MANIFEST_DIR="${NEW_MANIFEST_DIR}/${NEW_VERSION}"
REPLACE_VERSION=${REPLACE_VERSION:-${OLD_VERSION}}
REPLACE_VERSION_OLD_MANIFEST_DIR="${OLD_MANIFEST_DIR}/${REPLACE_VERSION}"

if [ ! -d "${OLD_VERSION_OLD_MANIFEST_DIR}" ]; then
  echo "Did not find the old version of the manifest: ${OLD_VERSION_OLD_MANIFEST_DIR}"
  exit 1
fi
if [ ! -d "${REPLACE_VERSION_OLD_MANIFEST_DIR}" ]; then
  echo "Did not find the replace version of the manifest: ${REPLACE_VERSION_OLD_MANIFEST_DIR}"
  exit 1
fi
if [ -d "${NEW_VERSION_OLD_MANIFEST_DIR}" ]; then
  echo "There is already a new version of the manifest: ${NEW_VERSION_OLD_MANIFEST_DIR}"
  exit 1
fi

# If wanting a new manifest bundle name then
#   Copy the old manifest bundle directory to a new manifest bundle directory
#   Change the name of the package yaml.

if [ "${NEW_MANIFEST}" != "${OLD_MANIFEST}" ]; then
  if ! cp -R "${OLD_MANIFEST_DIR}" "${NEW_MANIFEST_DIR}"; then
    echo "Failed to copy the old manifest bundle directory [${OLD_MANIFEST_DIR}] to a new one [${NEW_MANIFEST_DIR}]"
    exit 1
  fi
  if [ ! -z "${NEW_PACKAGE_NAME}" ]; then
    if ! mv "$(ls -1 ${NEW_MANIFEST_DIR}/*.package.yaml)" "${NEW_MANIFEST_DIR}/${NEW_PACKAGE_NAME}.package.yaml"; then
      echo "Failed to rename the old package YAML file to use the new package name of [${NEW_PACKAGE_NAME}]"
      exit 1
    fi
  fi
fi

# Create a new version directory, starting it out as a copy of the old version

if ! cp -R "${OLD_VERSION_NEW_MANIFEST_DIR}" "${NEW_VERSION_NEW_MANIFEST_DIR}"; then
  echo "Failed to copy the old version directory [${OLD_VERSION_NEW_MANIFEST_DIR}] to a new one [${NEW_VERSION_NEW_MANIFEST_DIR}]"
  exit 1
fi

# Update the package yaml to point to the new version

PACKAGE_YAML="$(ls -1 ${NEW_MANIFEST_DIR}/*.package.yaml)"
sed -i "s/v${OLD_VERSION}/v${NEW_VERSION}/gw /tmp/kiali-manifest-changes.txt" ${PACKAGE_YAML}
if [ ! -s /tmp/kiali-manifest-changes.txt ]; then
  echo "It looks like the old version was not the latest. Check the kiali package YAML file and your version strings."
  echo PACKAGE_YAML: ${PACKAGE_YAML}
  echo OLD_VERSION: ${OLD_VERSION}
  exit 1
fi

# Rename the copy of the old manifest CSV to the new version

OLD_VERSION_CSV_YAML="$(ls -1 ${NEW_VERSION_NEW_MANIFEST_DIR}/*v${OLD_VERSION}.clusterserviceversion.yaml)"
NEW_VERSION_CSV_YAML="$(echo ${OLD_VERSION_CSV_YAML} | sed s/${OLD_VERSION}/${NEW_VERSION}/)"
if [ -z ${OLD_VERSION_CSV_YAML} ]; then
  echo "Cannot find the old version CSV yaml file: ${OLD_VERSION_CSV_YAML}"
  exit 1
fi
mv ${OLD_VERSION_CSV_YAML} ${NEW_VERSION_CSV_YAML}

# Replace all occurences of the old version with the new version in the CSV YAML file

sed -i "s/${OLD_VERSION}/${NEW_VERSION}/g" ${NEW_VERSION_CSV_YAML}

# If an explicit operator image was specified by the user, use that image specifier in the CSV YAML file

if [ ! -z "${OPERATOR_IMAGE}" ]; then
  sed -i "s|image: .*kiali.*operator.*|image: ${OPERATOR_IMAGE}|g" ${NEW_VERSION_CSV_YAML}
  sed -i "s|containerImage: .*kiali.*operator.*|containerImage: ${OPERATOR_IMAGE}|g" ${NEW_VERSION_CSV_YAML}
fi

# If an explicit kiali image was specified by the user, use that image specifier in the CSV YAML file

if [ ! -z "${KIALI_IMAGE}" ]; then
  # skip lines that refer to the operator image - we don't want to change those
  sed -E -i "/.*kiali.*-operator.*/ n; s~(value:|image:)(.*/.*kiali.*:.*)~\1 ${KIALI_IMAGE}~g" ${NEW_VERSION_CSV_YAML}
fi

# Update the "replaces" metadata so the CSV indicates it is replacing the old version

OLD_REPLACE_VERSION="$(grep -P '^\s+replaces:\s+kiali-operator\.v(.*)\s*$' ${NEW_VERSION_CSV_YAML}|sed 's/^.*\.v\(.*\)$/\1/')"
sed -i "s/${OLD_REPLACE_VERSION}/${REPLACE_VERSION}/gw /tmp/kiali-manifest-changes.txt" ${NEW_VERSION_CSV_YAML}
if [ ! -s /tmp/kiali-manifest-changes.txt ]; then
  echo "It looks like 'replaces' metadata was not changed in the new CSV file. Check the new CSV file for correctness."
  echo CSV FILE: ${NEW_VERSION_CSV_YAML}
  exit 1
fi

# Update the "createdAt" metadata to right now

DATETIME_NOW="$(date --utc +'%FT%TZ')"
sed -i "s/createdAt: .\+Z/createdAt: ${DATETIME_NOW}/gw /tmp/kiali-manifest-changes.txt" ${NEW_VERSION_CSV_YAML}
if [ ! -s /tmp/kiali-manifest-changes.txt ]; then
  echo "It looks like 'createdAt' metadata was not changed in the new CSV file. Check the new CSV file for correctness."
  echo CSV FILE: ${NEW_VERSION_CSV_YAML}
  exit 1
fi

# Verify the correctness using operator-courier tool

if [ "${OPERATOR_COURIER_VERIFY}" == "true" ]; then
  echo "Verifying the correctness of the manifest"
  if ! operator-courier verify ${NEW_MANIFEST_DIR} ; then
    echo "Failed to verify the manifest. Check the errors and correct them before publishing the manifest."
    exit 1
  fi
else
  echo "Skipping manifest verification"
fi

# Completed!

echo "Manifest bundle: ${NEW_MANIFEST_DIR}"
ls ${NEW_MANIFEST_DIR}
echo
echo "New version: ${NEW_VERSION_NEW_MANIFEST_DIR}"
ls ${NEW_VERSION_NEW_MANIFEST_DIR}

