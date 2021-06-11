#!/bin/bash

##############################################################################
# docker-io-auth.sh
#
# Due to docker.io introducing rate limiting, many times you will be unable
# to have your OpenShift cluster pull images from docker.io.[1]
#
# This script creates the necessary OpenShift resources (mainly the pull
# secret) in order to get OpenShift to authenticate with docker.io with
# your own docker.io credentials thus providing your OpenShift cluster
# with more (though not unlimited) capacity to pull images.[2]
#
# It is recommended that you create a docker.io access token[3] and use that
# instead of using your docker.io password in the OpenShift pull secret.
#
# For each pod that you know will need to pull down images from docker.io,
# you need to obtain the name of that pod's service account and provide the name
# of that service account to this script. You can provide multiple service accounts
# by providing a space-delimited list of names in the --sa option.
#
# For more details see:
#   [1] https://developers.redhat.com/blog/2021/02/18/how-to-work-around-dockers-new-download-rate-limit-on-red-hat-openshift#authenticate_to_your_docker_hub_account
#   [2] https://docs.openshift.com/container-platform/4.6/openshift_images/managing_images/using-image-pull-secrets.html#images-allow-pods-to-reference-images-from-secure-registries_using-image-pull-secrets
#   [3] https://docs.docker.com/docker-hub/access-tokens/
#
##############################################################################

DEFAULT_DOCKER_SERVER="docker.io"
DEFAULT_NAMESPACE="istio-system"
DEFAULT_OC="oc"
DEFAULT_SECRET_NAME="docker"
DEFAULT_SERVICE_ACCOUNTS="prometheus grafana default"

# Change to the directory where this script is and set our env
cd "$(dirname "${BASH_SOURCE[0]}")"

_CMD=""
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -de|--docker-email)     DOCKER_EMAIL="$2";     shift;shift ;;
    -dp|--docker-password)  DOCKER_PASSWORD="$2";  shift;shift ;;
    -ds|--docker-server)    DOCKER_SERVER="$2";    shift;shift ;;
    -du|--docker-username)  DOCKER_USERNAME="$2";  shift;shift ;;
    -n|--namespace)         NAMESPACE="$2";        shift;shift ;;
    -oc)                    OC="$2";               shift;shift ;;
    -sa|--service-accounts) SERVICE_ACCOUNTS="$2"; shift;shift ;;
    -sn|--secret-name)      SECRET_NAME="$2";      shift;shift ;;
    -h|--help)
      cat <<HELPMSG

$0 [option...] command

Valid options:
  -de|--docker-email
      Your email used by your docker account. This is required and has no default.
  -dp|--docker-password
      Your credentials used to authenticate your docker account. This is required and has no default.
      It is highly recommended you use an access token rather than your actual password.
  -ds|--docker-server
      The repository server name.
      Default: ${DEFAULT_DOCKER_SERVER}
  -du|--docker-username
      Your docker repository user name. This is required and has no default.
  -n|--namespace
      The namespace where the pull secret will be created and where the service accounts are located.
      Default: ${DEFAULT_NAMESPACE}
  -oc
      The OpenShift 'oc' client executable.
      Default: ${DEFAULT_OC}
  -sa|--service-accounts
      The service accounts that will be able to authenticate with docker with the credentials you provide.
      You can specify more than one service account separated with spaces.
      If you are using this to be able to pull Istio addon images, this value should be "prometheus grafana default".
      Default: ${DEFAULT_SERVICE_ACCOUNTS}
  -sn|--secret-name
      The name of the pull secret that will be created that will contain your docker credentials.
      Default: ${DEFAULT_SECRET_NAME}
HELPMSG
      exit 1
      ;;
    *)
      echo "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

: ${DOCKER_SERVER:=${DEFAULT_DOCKER_SERVER}}
: ${NAMESPACE:=${DEFAULT_NAMESPACE}}
: ${OC:=${DEFAULT_OC}}
: ${SERVICE_ACCOUNTS:=${DEFAULT_SERVICE_ACCOUNTS}}
: ${SECRET_NAME:=${DEFAULT_SECRET_NAME}}

[ -z "$DOCKER_EMAIL" ] && echo "You must specify --docker-email" && exit 1
[ -z "$DOCKER_PASSWORD" ] && echo "You must specify --docker-password" && exit 1
[ -z "$DOCKER_USERNAME" ] && echo "You must specify --docker-username" && exit 1

echo "DOCKER_EMAIL=$DOCKER_EMAIL"
echo "DOCKER_PASSWORD=..."
echo "DOCKER_SERVER=$DOCKER_SERVER"
echo "DOCKER_USERNAME=$DOCKER_USERNAME"
echo "NAMESPACE=$NAMESPACE"
echo "OC=$OC"
echo "SERVICE_ACCOUNTS=$SERVICE_ACCOUNTS"
echo "SECRET_NAME=$SECRET_NAME"

set -u

echo "Creating the pull secret [${SECRET_NAME}] in namespace [${NAMESPACE}]"
${OC} create secret docker-registry ${SECRET_NAME} -n ${NAMESPACE} --docker-server=${DOCKER_SERVER} --docker-username=${DOCKER_USERNAME} --docker-password=${DOCKER_PASSWORD} --docker-email=${DOCKER_EMAIL}

for sa in ${SERVICE_ACCOUNTS}; do
  echo "Linking the pull secret [${SECRET_NAME}] with service account [${sa}]"
  ${OC} secrets link -n ${NAMESPACE} ${sa} ${SECRET_NAME} --for=pull
done

echo "========== NOTICE =========="
echo "Delete any previously existing pods that are currently failing to download images."
echo "New pods that come online now should be able to pull images."
