#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"

while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -mn|--manifest-name)
      MANIFEST="$2"
      shift;shift
      ;;
    -nv|--new-version)
      NEW_VERSION="$2"
      shift;shift
      ;;
    -ov|--old-version)
      OLD_VERSION="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
$0 [option...]

Valid options:
  -mn|--manifest-name
      The name of the directory containing the manifest files.
      This is a relative name (not a path) and must be located in the same directory where this script lives.
  -nv|--new-version
      The new version that is going to be released. New manifest files for this version will be created.
  -ov|--old-version
      The old version that is going to be superceded with the new release. This must be the previous release
      prior to the new version. For example, if there is already versions 1.0 and 1.1 and the new version is
      2.0, the old version to be specified must be 1.1.
HELPMSG
      exit 1
      ;;
    *)
      echo "Unknown argument [$key].  Aborting."
      exit 1
      ;;
  esac
done

if [ ! -d "${SCRIPT_DIR}/${MANIFEST:-!notvalid!}" ]; then
  echo "You must specify a valid manifest directory located in ${SCRIPT_DIR}"
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

MANIFEST_DIR="${SCRIPT_DIR}/$(echo ${MANIFEST} | tr -d '/')"
OLD_VERSION_MANIFEST_DIR="${MANIFEST_DIR}/${OLD_VERSION}"
NEW_VERSION_MANIFEST_DIR="${MANIFEST_DIR}/${NEW_VERSION}"

if [ ! -d "${OLD_VERSION_MANIFEST_DIR}" ]; then
  echo "Did not find the old version of the manifest: ${MANIFEST_DIR}/${OLD_VERSION}"
  exit 1
fi
if [ -d "${NEW_VERSION_MANIFEST_DIR}" ]; then
  echo "There is already a new version of the manifest: ${MANIFEST_DIR}/${NEW_VERSION}"
  exit 1
fi

# Copy the old version manifest directory to a new version directory

if ! cp -R "${OLD_VERSION_MANIFEST_DIR}" "${NEW_VERSION_MANIFEST_DIR}"; then
  echo "Failed to copy the old manifest directory [${OLD_VERSION_MANIFEST_DIR}] to a new one [${NEW_VERSION_MANIFEST_DIR}]"
  exit 1
fi

# Update the package yaml to point to the new version

PACKAGE_YAML="$(ls -1 ${MANIFEST_DIR}/*.package.yaml)"
sed -i "s/v${OLD_VERSION}/v${NEW_VERSION}/gw /tmp/kiali-manifest-changes.txt" $PACKAGE_YAML
if [ ! -s /tmp/kiali-manifest-changes.txt ]; then
  echo "It looks like the old version was not the latest. Check the kiali package YAML file and your version strings."
  echo PACKAGE_YAML: ${PACKAGE_YAML}
  echo OLD_VERSION: ${OLD_VERSION}
  exit 1
fi

# Rename the copy of the old manifest CSV to the new version

OLD_VERSION_CSV_YAML="$(ls -1 ${NEW_VERSION_MANIFEST_DIR}/*v${OLD_VERSION}.clusterserviceversion.yaml)"
NEW_VERSION_CSV_YAML="$(echo ${OLD_VERSION_CSV_YAML} | sed s/${OLD_VERSION}/${NEW_VERSION}/)"
if [ -z ${OLD_VERSION_CSV_YAML} ]; then
  echo "Cannot find the old version CSV yaml file: ${OLD_VERSION_CSV_YAML}"
  exit 1
fi
mv ${OLD_VERSION_CSV_YAML} ${NEW_VERSION_CSV_YAML}

# Replace all occurences of the old version with the new version in the CSV YAML file

sed -i "s/${OLD_VERSION}/${NEW_VERSION}/g" ${NEW_VERSION_CSV_YAML}

# Update the "replaces" metadata so the CSV indicates it is replacing the old version

sed -i "s/replaces: kiali-operator.v.*/replaces: kiali-operator.v${OLD_VERSION}/gw /tmp/kiali-manifest-changes.txt" ${NEW_VERSION_CSV_YAML}
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

# Completed!

echo "New manifest has been created: ${NEW_VERSION_MANIFEST_DIR}"
ls -l ${NEW_VERSION_MANIFEST_DIR}

