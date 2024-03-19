#!/bin/bash

##############################################################################
# download-istio.sh
#
# This simply confirms you have a specific Istio version installed in a
# specific output directory and if you do not it will download it.
#
# The 'istioctl' client tool will be found in <output-dir>/istio-#/bin
# where "#" is the Istio version.
#
# By default, the version will be the latest version of Istio.
# By default, the output directory will be ../../_output.
#
# You can set the version you want as well as your own output directory.
# See the --help output for details.
##############################################################################

# The version used by the getLatestIstio script - if empty, gets the latest version
ISTIO_VERSION=

# process command line args
while [ $# -gt 0 ]; do
  key="$1"
  case $key in
    -div|--dev-istio-version)
      DEV_ISTIO_VERSION="$2"
      shift;shift
      ;;
    -iv|--istio-version)
      ISTIO_VERSION="$2"
      shift;shift
      ;;
    -o|--output)
      OUTPUT_DIR="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -div|--dev-istio-version <version>: If you want a dev version to download, use this option and do not use -iv.
                                      The value of this option is something like "1.4-dev" or "1.5-dev". If you
                                      want the latest master build, set this to "latest".
  -iv|--istio-version <#.#.#>: Released version of Istio to download. (default will be the latest version)
  -o|--output <dir> : Output directory where Istio is (or will be downloaded to if it doesn't exist).
  -h|--help : This message.
HELPMSG
      exit 1
      ;;
    *)
      echo "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

# Go to the main output directory
HACK_SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
OUTPUT_DIR="${OUTPUT_DIR:-${HACK_SCRIPT_DIR}/../../_output}"
mkdir -p "$OUTPUT_DIR"
cd "$OUTPUT_DIR"
OUTPUT_DIR="$(pwd)" # remove the .. references
echo "Output Directory: ${OUTPUT_DIR}"

if [ -z "${ISTIO_VERSION}" ]; then
  if [ -z "${DEV_ISTIO_VERSION}" ]; then
    # get the latest released version
    while [ -z "${VERSION_WE_WANT:-}" ]; do
      VERSION_WE_WANT=$(curl -L -s https://api.github.com/repos/istio/istio/releases | \
            grep tag_name | sed -e 's/.*://' -e 's/ *"//' -e 's/",//' | \
            grep -v -E "(snapshot|alpha|beta|rc)\.[0-9]$" | sort -t"." -k 1.2g,1 -k 2g,2 -k 3g | tail -n 1)
      if [ -z "${VERSION_WE_WANT:-}" ]; then
        echo "Cannot get the latest Istio version from github. Will try again"
        sleep 2
      else
        echo "Will use the latest Istio version: [$VERSION_WE_WANT]"
      fi
    done
    ISTIO_VERSION="${VERSION_WE_WANT}"
  else
    # See https://github.com/istio/istio/wiki/Dev%20Builds
    VERSION_WE_WANT="$(curl -L -s https://storage.googleapis.com/istio-build/dev/${DEV_ISTIO_VERSION})"
    if [ -z "${VERSION_WE_WANT}" ]; then
      echo "There is no known build for dev version ${DEV_ISTIO_VERSION}"
      exit 1
    fi
  fi
else
  VERSION_WE_WANT="${ISTIO_VERSION}"
  echo "Will use a specific Istio version: $VERSION_WE_WANT"
fi

# See if Istio is downloaded; if not, get it now.
echo "Will look for Istio here: ${OUTPUT_DIR}/istio-${VERSION_WE_WANT}"
if [ ! -d "./istio-${VERSION_WE_WANT}" ]; then
  echo "Cannot find Istio ${VERSION_WE_WANT} - will download it now..."
  if [ -z "${DEV_ISTIO_VERSION}" ]; then
    export ISTIO_VERSION
    curl -L --retry 4 --retry-delay 5 https://istio.io/downloadIstio | sh -
  else
    # See https://github.com/istio/istio/wiki/Dev%20Builds
    curl -L https://gcsweb.istio.io/gcs/istio-build/dev/${VERSION_WE_WANT}/istio-${VERSION_WE_WANT}-linux-amd64.tar.gz | tar xvfz -
    if [ ! -d "./istio-${VERSION_WE_WANT}" ]; then
      echo "Could not download ${VERSION_WE_WANT}"
      exit 1
    fi
  fi
fi

cd "./istio-${VERSION_WE_WANT}/"
ISTIO_DIR="$(pwd)"
echo "Istio is found here: ${ISTIO_DIR}"
if [ -x "${ISTIO_DIR}/bin/istioctl" ]; then
  ISTIOCTL="${ISTIO_DIR}/bin/istioctl"
  ${ISTIOCTL} version
  echo "istioctl is found here: ${ISTIO_DIR}/bin/istioctl"
else
  echo "WARNING: istioctl is NOT found at ${ISTIO_DIR}/bin/istioctl"
  exit 1
fi
