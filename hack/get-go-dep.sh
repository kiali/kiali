#!/bin/sh

PROJECT_NAME="dep"

# LGOBIN represents the local bin location: can be either GOBIN, if set, or the GOPATH/bin.

LGOBIN=""

fail() {
   echo "$1"
   exit 1
}

verifyGoInstallation() {
   GO=$(which go)
   if [ "$?" = "1" ]; then
      fail "$PROJECT_NAME needs go. Please install it first."
   fi
   if [ -z "$GOPATH" ]; then
      fail "$PROJECT_NAME needs environment variable "'$GOPATH'". Set it before continue."
   fi
   if [ -n "$GOBIN" ]; then
      if [ ! -d "$GOBIN" ]; then
         fail "$GOBIN "'($GOBIN)'" folder not found. Please create it before continue."
      fi
      LGOBIN="$GOBIN"
   else
      if [ ! -d "$GOPATH/bin" ]; then
         fail "$GOPATH/bin "'($GOPATH/bin)'" folder not found. Please create it before continue."
      fi
      LGOBIN="$GOPATH/bin"
   fi
   echo "* Will install $PROJECT_NAME into the bin directory $LGOBIN"
}

initArch() {
   ARCH=$(uname -m)
   case $ARCH in
      armv5*) ARCH="armv5";;
      armv6*) ARCH="armv6";;
      armv7*) ARCH="armv7";;
      aarch64) ARCH="arm64";;
      x86) ARCH="386";;
      x86_64) ARCH="amd64";;
      i686) ARCH="386";;
      i386) ARCH="386";;
   esac
   echo "* ARCH=$ARCH"
}

initOS() {
   OS=$(echo `uname`|tr '[:upper:]' '[:lower:]')

   case "$OS" in
      # Minimalist GNU for Windows
      mingw*) OS='windows';;
      msys*) OS='windows';;
   esac
   echo "* OS=$OS"
}

initDownloadTool() {
   if type "curl" > /dev/null; then
      DOWNLOAD_TOOL="curl"
   elif type "wget" > /dev/null; then
      DOWNLOAD_TOOL="wget"
   else
      fail "You need curl or wget as download tool. Please install it first before continuing"
   fi
   echo "* Using $DOWNLOAD_TOOL as download tool"
}

get() {
   local url="$2"
   local body
   local httpStatusCode
   echo "* Getting $url"
   if [ "$DOWNLOAD_TOOL" = "curl" ]; then
      httpResponse=$(curl -sL --write-out HTTPSTATUS:%{http_code} "$url")
      httpStatusCode=$(echo $httpResponse | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
      body=$(echo "$httpResponse" | sed -e 's/HTTPSTATUS\:.*//g')
   elif [ "$DOWNLOAD_TOOL" = "wget" ]; then
      tmpFile=$(mktemp)
      body=$(wget --server-response --content-on-error -q -O - "$url" 2> $tmpFile || true)
      httpStatusCode=$(cat $tmpFile | awk '/^  HTTP/{print $2}')
   fi
   if [ "$httpStatusCode" != 200 ]; then
      echo "Request failed with http status code $httpStatusCode"
      fail "Body: $body"
   fi
   eval "$1='$body'"
}

getFile() {
   local url="$1"
   local filePath="$2"
   if [ "$DOWNLOAD_TOOL" = "curl" ]; then
      httpStatusCode=$(curl -s -w '%{http_code}' -L "$url" -o "$filePath")
   elif [ "$DOWNLOAD_TOOL" = "wget" ]; then
      body=$(wget --server-response --content-on-error -q -O "$filePath" "$url")
      httpStatusCode=$(cat $tmpFile | awk '/^  HTTP/{print $2}')
   fi
   echo "$httpStatusCode"
}

downloadFile() {
   DEP_DIST="dep-$OS-$ARCH"
   echo "* Binary distribution for your platform is expected to be $DEP_DIST"
   DEP_TMP_FILE="/tmp/$DEP_DIST"
   LATEST_RELEASE_URL="https://api.github.com/repos/golang/$PROJECT_NAME/releases/latest"
   echo "* Trying to find the latest release via github API: $LATEST_RELEASE_URL"
   get LATEST_RELEASE_JSON $LATEST_RELEASE_URL
   # || true forces this command to not catch error if grep does not find anything
   DOWNLOAD_URL=$(echo "$LATEST_RELEASE_JSON" | grep 'browser_' | cut -d\" -f4 | grep "${DEP_DIST}\$") || true
   if [ -z "$DOWNLOAD_URL" ]; then
      fail "There is no dist for your system: $OS $ARCH"
   else
      echo "* Downloading the latest binary dist from $DOWNLOAD_URL"
      httpStatusCode=$(getFile "$DOWNLOAD_URL" "$DEP_TMP_FILE")
      if [ "$httpStatusCode" -ne 200 ]; then
         fail "Failed to download dist. status code=$httpStatusCode"
      fi
   fi
}

installFile() {
   DEP_DIST="dep-$OS-$ARCH"
   DEP_TMP_FILE="/tmp/$DEP_DIST"
   echo "* Copying $DEP_TMP_FILE to $LGOBIN"
   chmod +x $DEP_TMP_FILE
   cp "$DEP_TMP_FILE" "${LGOBIN}/dep"
   rm -f $DEP_TMP_FILE
}

bye() {
   result=$?
   if [ "$result" != "0" ]; then
      echo "Failed to install $PROJECT_NAME"
   fi
   exit $result
}

testVersion() {
   set +e
   DEP="$(which $PROJECT_NAME)"
   if [ "$?" = "1" ]; then
      fail "$PROJECT_NAME not found. Did you add $LGOBIN to your PATH?"
   fi
   set -e
   _DEP_VERSION=$($PROJECT_NAME version)
   echo $_DEP_VERSION
   echo "* $PROJECT_NAME has been installed successfully"
}


# Execution

#Stop execution on any error
trap "bye" EXIT
verifyGoInstallation
set -e
initArch
initOS
initDownloadTool
downloadFile
installFile
testVersion
