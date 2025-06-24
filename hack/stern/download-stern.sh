#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
cd "$SCRIPT_DIR/"

# specify grep executable
if [[ "$OS" == "darwin" ]]; then
  GREP_CMD="ggrep"
else
  GREP_CMD="grep"
fi

# Check if stern binary exists
if [ -f "stern" ]; then
  echo "Stern executable found."
else
  echo "Downloading stern executable..."
  # Define variables
  REPO="stern/stern"
  ARCH="$(uname -m)"
  OS="$(uname -s | tr '[:upper:]' '[:lower:]')"

  # Normalize ARCH for stern naming
  if [[ "$ARCH" == "x86_64" ]]; then
    ARCH="amd64"
  elif [[ "$ARCH" == "aarch64" || "$ARCH" == "arm64" ]]; then
    ARCH="arm64"
  fi

  # Normalize OS string for stern naming
  if [[ "$OS" == "darwin" ]]; then
    OS="darwin"
  elif [[ "$OS" == "linux" ]]; then
    OS="linux"
  fi

  # Get latest version tag from GitHub API
  VERSION=$(curl -s "https://api.github.com/repos/$REPO/releases/latest" | $GREP_CMD -oP '"tag_name": "\K(.*)(?=")' | sed 's/^v//')

  # Define the filename and URL
  FILENAME="stern_${VERSION}_${OS}_${ARCH}.tar.gz"
  URL="https://github.com/${REPO}/releases/download/v${VERSION}/${FILENAME}"

  echo $URL
  echo $FILENAME

  # Download and extract, clean archive
  echo "Downloading Stern ${LATEST}..."
  curl -LO "$URL"
  tar -xzf "$FILENAME"
  rm LICENSE "$FILENAME"

  chmod +x ./stern
fi

# Print stern version
echo "Stern $(./stern --version | $GREP_CMD version ) installed successfully!"
