#!/bin/sh

DEP_NAME="dep"
DEP_BIN_DIR="unknown"
GET_UTIL="unknown"
DEP_DIST="unknown"

validateGoLang() {
   $(which go > /dev/null)
   if [ "$?" = "1" ]; then
      fail "$DEP_NAME needs GoLang to be installed. Please install it."
   fi
   if [ -z "$GOPATH" ]; then
      fail "$DEP_NAME needs the environment variable GOPATH to be set. Please set it."
   fi
   if [ -n "$GOBIN" ]; then
      if [ ! -d "$GOBIN" ]; then
         fail "The environment variable GOBIN was set but does not refer to an existing directory: $GOBIN"
      fi
      DEP_BIN_DIR="$GOBIN"
   else
      if [ ! -d "$GOPATH/bin" ]; then
         fail "The bin directory under GOPATH is missing: $GOPATH/bin"
      fi
      DEP_BIN_DIR="$GOPATH/bin"
   fi
   echo "* $DEP_NAME will be installed into the directory $DEP_BIN_DIR"
}

validateGetUtil() {
   if type "curl" > /dev/null; then
      GET_UTIL="curl"
   elif type "wget" > /dev/null; then
      GET_UTIL="wget"
   else
      fail "Neither 'curl' or 'wget' is installed on this machine. Please install one."
   fi
   echo "* Will use $GET_UTIL to download artifacts from the web"
}

validateMachineDetails() {
   local arch=$(uname -m)
   case $arch in
      aarch64) arch="arm64" ;;
      armv5*)  arch="armv5" ;;
      armv6*)  arch="armv6" ;;
      armv7*)  arch="armv7" ;;
      i386)    arch="386"   ;;
      i686)    arch="386"   ;;
      x86)     arch="386"   ;;
      x86_64)  arch="amd64" ;;
   esac

   local os=$(echo `uname` | tr '[:upper:]' '[:lower:]')
   case "$os" in
      mingw*) os='windows' ;;
      msys*)  os='windows' ;;
   esac

   DEP_DIST="dep-$os-$arch"
   echo "* $DEP_NAME distribution file name for your platform is expected to be $DEP_DIST"
}

setUrlResponseToEnvVar() {
   # $1 is an env var whose value will be that of the http response
   # $2 is the URL whose response string will be used as the value of the env var passed in $1
   local url="$2"
   local body
   local httpStatusCode
   local httpResponse
   echo "* Getting $url"
   if [ "$GET_UTIL" = "curl" ]; then
      httpResponse=$(curl -sL --write-out HTTPSTATUS:%{http_code} "$url")
      httpStatusCode=$(echo $httpResponse | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
      body=$(echo "$httpResponse" | sed -e 's/HTTPSTATUS\:.*//g')
   elif [ "$GET_UTIL" = "wget" ]; then
      tmpFile=$(mktemp)
      body=$(wget --server-response --content-on-error -q -O - "$url" 2> $tmpFile || true)
      httpStatusCode=$(cat $tmpFile | awk '/^  HTTP/{print $2}')
   fi
   if [ "$httpStatusCode" != 200 ]; then
      echo "HTTP request failed with http status code $httpStatusCode"
      fail "HTTP response: $body"
   fi
   eval "$1='$body'"
}

getFileFromUrl() {
   local url="$1"
   local filePath="$2"
   if [ "$GET_UTIL" = "curl" ]; then
      httpStatusCode=$(curl -s -w '%{http_code}' -L "$url" -o "$filePath")
   elif [ "$GET_UTIL" = "wget" ]; then
      body=$(wget --server-response --content-on-error -q -O "$filePath" "$url")
      httpStatusCode=$(cat $tmpFile | awk '/^  HTTP/{print $2}')
   fi
   echo "$httpStatusCode"
}

downloadFile() {
   local depDistFile="${DEP_BIN_DIR}/dep"
   local latestReleaseUrl="https://api.github.com/repos/golang/dep/releases/latest"
   echo "* Trying to find the latest release via github API: $latestReleaseUrl"
   setUrlResponseToEnvVar LATEST_RELEASE_JSON $latestReleaseUrl
   local downloadUrl=$(echo "$LATEST_RELEASE_JSON" | grep 'browser_' | cut -d\" -f4 | grep "${DEP_DIST}\$") || true
   if [ -z "$downloadUrl" ]; then
      fail "There is no distribution for your system: $DEP_DIST"
   else
      echo "* Downloading the latest $DEP_NAME binary distribution from $downloadUrl"
      local httpStatusCode=$(getFileFromUrl "$downloadUrl" "$depDistFile")
      if [ "$httpStatusCode" -ne 200 ]; then
         fail "Failed to download the binary distribution. status code=$httpStatusCode"
      fi
   fi

   chmod +x $depDistFile
   echo "* $DEP_NAME distribution downloaded to: $depDistFile"
}

validateBinaryDist() {
   set +e
   $(which dep > /dev/null)
   if [ "$?" = "1" ]; then
      fail "dep not found. Did you add $DEP_BIN_DIR to your PATH?"
   fi
   set -e
   local depVersion=$(dep version)
   echo $depVersion
   echo "* $DEP_NAME has been installed successfully"
}

fail() {
   echo "$1"
   exit 1
}

terminate() {
   result=$?
   if [ "$result" != "0" ]; then
      echo "Failed to install $DEP_NAME"
   fi
   exit $result
}


# START HERE

trap "terminate" EXIT
trap "fail Abort" SIGQUIT SIGINT SIGSTOP
validateGoLang
set -e
validateGetUtil
validateMachineDetails
downloadFile
validateBinaryDist
