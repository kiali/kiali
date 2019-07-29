#!/bin/sh

# Based on: https://github.com/sudo-bmitch/jenkins-docker

set -x

# Get gid of docker socket file
SOCK_DOCKER_GID=`stat -c '%g' /var/run/docker.sock`

# Get docker's groupId inside container
CUR_DOCKER_GID=`getent group docker | cut -f3 -d: || true`

# If docker's groupId != gid of docker socket file, adjust to make them match
if [ ! -z "$SOCK_DOCKER_GID" -a "$SOCK_DOCKER_GID" != "$CUR_DOCKER_GID" ]; then
    groupmod -g ${SOCK_DOCKER_GID} -o docker
fi

# Run original entry point
exec gosu jenkins tini -- /usr/local/bin/jenkins.sh "$@"