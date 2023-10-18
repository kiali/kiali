#!/bin/bash

#
# Refer to the --help output for a description of this script and its available options.
#

infomsg() {
  echo "[INFO] ${1}"
}

helpmsg() {
  cat <<HELP
This script will run the Kiali molecule tests within an existing OpenShift cluster.
It tests the latest published images, but has options to allow you to test dev images
built from specified branches, thus allowing you to test PRs and other dev builds.

You can use this as a cronjob to test Kiali periodically.

Some of the defaults used by this script assume you started the cluster via the script
provided by https://github.com/kxr/ocp4_setup_upi_kvm - see that project for more details.

To use your own existing OpenShift cluster, you will want to look at the
options -kp (or -kpf), -ku, and -oapi.

Options:

-at|--all-tests <tests>
    Space-separated list of all the molecule tests to be run.
    Note that this list may not be the tests that are actually run - see --skip-tests.
    Default: <all tests in kiali-operator repo /molecule directory>

-dorp|--docker-or-podman <docker|podman>
    What to use when building images.
    Default: docker

-gcp|--git-clone-protocol <git|https>
    Determine what protocol to use when git cloning the repos.
    If you want to upload logs (-ul true), you must set this to "git".
    Default: git

-hb|--helm-branch <branch name>
    The helm-chart branch to clone.
    Default: master

-hf|--helm-fork <name>
    The helm-chart fork/org to clone.
    Default: kiali

-ii|--install-istio <true|false>
    If true, an Istio control plane will be installed
    in 'istio-system' namespace if one does not already exist.
    If false, and no Istio is installed, this script aborts.
    If you elect to install Istio, you can indicate which
    Istio version you want via -iv option.
    Default: true

-ir|--irc-room <irc room name>
    The libera IRC room to send the results message.
    Set to "" to not send any message.
    Default: kiali-molecule-tests

-iv|--istio-version <#.#.#>
    The version of Istio you want to install.
    This option is ignored if -ii is false.
    If not specified, the latest version of Istio is installed.
    Default: <the latest release>

-kb|--kiali-branch <branch name>
    The kiali branch to clone.
    Default: master

-kf|--kiali-fork <name>
    The kiali fork/org to clone.
    Default: kiali

-kob|--kiali-operator-branch <branch name>
    The kiali-operator branch to clone.
    Default: master

-kof|--kiali-operator-fork <name>
    The kiali-operator fork/org to clone.
    Default: kiali

-kp|--kubeadmin-pw <password>
    The password for the kubeadmin user.
    If you want this more secure, put the password in a file and use -kpf.
    Default: <unset>

-kpf|--kubeadmin-pw-file <filename>
    The file containing the kubeadmin password. If the file is not readable by the user
    running this script, the script will attempt to read it via "sudo".
    Default: /root/ocp4_cluster_ocp4/install_dir/auth/kubeadmin-password

-ku|--kubeadmin-user <username>
    A username that has kubeadmin permissions.
    Default: kubeadmin

-lb|--logs-branch <branch name>
    The logs branch to clone.
    Default: openshift

-lf|--logs-fork <name>
    The logs fork/org to clone.
    Default: jmazzitelli

-lpn|--logs-project-name <name>
    The project name within the logs fork/org to clone.
    Default: kiali-molecule-test-logs

-oapi|--openshift-api <OpenShift API URL>
    The URL to the OpenShift API. This is the endpoint used by "oc login".
    Default: https://api.ocp4.local:6443

-oc <path to oc>
    The full path to the 'oc' command.
    If 'oc' is in your PATH, you can pass the option as '-oc \$(which oc)'
    Default: /root/ocp4_cluster_ocp4/oc

-oi|--operator-installer <helm|skip>
    How the operator is to be installed by the molecule tests. It is either installed
    via helm or the installation is skipped entirely. Use "skip" if you installed the
    operator yourself (say, via OLM) and you want the molecule tests to use it rather
    than to install its own operator.
    Default: helm

-rr|--reduce-resources <true|false>
    When true, and if Istio will be installed (see --install-istio), some Istio components
    (such as sidecar proxies) will be given a smaller amount of resources (CPU and memory)
    which will allow you to run the tests on a cluster that does not have a large amount
    of resources.
    Default: false

-sd|--src-dir <directory>
    Where the git source repositories will be cloned.
    Default: /tmp/KIALI-GIT

-st|--skip-tests <tests>
    Space-separated list of all the molecule tests to be skipped.
    Default: <tests that are unable to be run on OpenShift>

-sv|--spec-version <version>
    When the molecule tests create Kiali CR resources, this will be the value of
    the spec.version field. This effectively is how you can test different
    playbooks in the operator.

-udi|--use-dev-images <true|false>
    If true, the tests will use locally built dev images of Kiali and the operator.
    When using dev images, this script will attempt to build and push dev images
    into your cluster. If your environment is not set up for development
    (e.g. you do not have Go installed), then this script will fail.
    If false, the cluster will simply pull the 'latest' images published on quay.io.
    Default: false

-udefi|--use-default-images <true|false>
    If true (and --use-dev-images is 'false') no specific image name or version will be specified in
    the CRs that are created by the molecule tests. In other words, spec.deployment.image_name and
    spec.deployment.image_version will be empty strings. This means the Kial server image and the OSSMC image
    that will be deployed in the tests will be determined by the operator defaults.
    This is useful when testing with a specific spec.version (--spec-version) and you want the operator
    to install the default server image for that version.
    Default: false

-ul|--upload-logs <true|false>
    If you want to upload the logs to the git repo, set this to true.
    Otherwise, set this to false. The logs will remain on the local machine,
    but will not be committed to the remote git repo.
    If the IRC message will be sent, you can at least be told if there were
    failures during any one of the tests.
    Default: false
HELP
}

# process command line arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -at|--all-tests)              ALL_TESTS="$2";             shift;shift; ;;
    -dorp|--docker-or-podman)     DORP="$2";                  shift;shift; ;;
    -gcp|--git-clone-protocol)    GIT_CLONE_PROTOCOL="$2";    shift;shift; ;;
    -hb|--helm-branch)            HELM_BRANCH="$2";           shift;shift; ;;
    -h|--help)                    helpmsg;                    exit 1       ;;
    -hf|--helm-fork)              HELM_FORK="$2";             shift;shift; ;;
    -ii|--install-istio)          INSTALL_ISTIO="$2";         shift;shift; ;;
    -ir|--irc-room)               IRC_ROOM="$2";              shift;shift; ;;
    -iv|--istio-version)          ISTIO_VERSION="$2";         shift;shift; ;;
    -kb|--kiali-branch)           KIALI_BRANCH="$2";          shift;shift; ;;
    -kf|--kiali-fork)             KIALI_FORK="$2";            shift;shift; ;;
    -kob|--kiali-operator-branch) KIALI_OPERATOR_BRANCH="$2"; shift;shift; ;;
    -kof|--kiali-operator-fork)   KIALI_OPERATOR_FORK="$2";   shift;shift; ;;
    -kp|--kubeadmin-pw)           KUBEADMIN_PW="$2";          shift;shift; ;;
    -kpf|--kubeadmin-pw-file)     KUBEADMIN_PW_FILE="$2";     shift;shift; ;;
    -ku|--kubeadmin-user)         KUBEADMIN_USER="$2";        shift;shift; ;;
    -lb|--logs-branch)            LOGS_BRANCH="$2";           shift;shift; ;;
    -lf|--logs-fork)              LOGS_FORK="$2";             shift;shift; ;;
    -lpn|--logs-project-name)     LOGS_PROJECT_NAME="$2";     shift;shift; ;;
    -oapi|--openshift-api)        OPENSHIFT_API="$2";         shift;shift; ;;
    -oc)                          OC="$2";                    shift;shift; ;;
    -oi|--operator-installer)     OPERATOR_INSTALLER="$2";    shift;shift; ;;
    -rr|--reduce-resources)       REDUCE_RESOURCES="$2";      shift;shift; ;;
    -sd|--src-dir)                SRC="$2";                   shift;shift; ;;
    -st|--skip-tests)             SKIP_TESTS="$2";            shift;shift; ;;
    -sv|--spec-version)           SPEC_VERSION="$2";          shift;shift; ;;
    -udi|--use-dev-images)        USE_DEV_IMAGES="$2";        shift;shift; ;;
    -udefi|--use-default-images)  USE_DEFAULT_IMAGES="$2";    shift;shift; ;;
    -ul|--upload-logs)            UPLOAD_LOGS="$2";           shift;shift; ;;
    *) echo "Unknown argument: [$key]. Aborting."; helpmsg; exit 1 ;;
  esac
done

# abort on any error
set -e

# set up some of our defaults
KUBEADMIN_USER="${KUBEADMIN_USER:-kubeadmin}"
KUBEADMIN_PW_FILE="${KUBEADMIN_PW_FILE:-/root/ocp4_cluster_ocp4/install_dir/auth/kubeadmin-password}"
OC=${OC:-/root/ocp4_cluster_ocp4/oc}
OPENSHIFT_API=${OPENSHIFT_API:-https://api.ocp4.local:6443}
SRC="${SRC:-/tmp/KIALI-GIT}"
DORP="${DORP:-docker}"
GIT_CLONE_PROTOCOL="${GIT_CLONE_PROTOCOL:-git}"

# if you want to test code from different forks and/or branches, set them here
HELM_FORK="${HELM_FORK:-kiali}"
HELM_BRANCH="${HELM_BRANCH:-master}"
KIALI_FORK="${KIALI_FORK:-kiali}"
KIALI_BRANCH="${KIALI_BRANCH:-master}"
KIALI_OPERATOR_FORK="${KIALI_OPERATOR_FORK:-kiali}"
KIALI_OPERATOR_BRANCH="${KIALI_OPERATOR_BRANCH:-master}"

# details about the github repo where the logs are to be stored
LOGS_PROJECT_NAME="${LOGS_PROJECT_NAME:-kiali-molecule-test-logs}"
LOGS_FORK="${LOGS_FORK:-jmazzitelli}"
LOGS_BRANCH="${LOGS_BRANCH:-openshift}"

LOGS_LOCAL_DIRNAME="${LOGS_PROJECT_NAME}"
LOGS_LOCAL_DIRNAME_ABS="${SRC}/${LOGS_LOCAL_DIRNAME}"
LOGS_LOCAL_SUBDIR="molecule-tests-$(date +'%Y-%m-%d_%H-%M-%S')"
LOGS_LOCAL_SUBDIR_ABS="${LOGS_LOCAL_DIRNAME_ABS}/${LOGS_LOCAL_SUBDIR}"
LOGS_LOCAL_RESULTS="${LOGS_LOCAL_SUBDIR_ABS}/results.log"
LOGS_GITHUB_HTTPS_BASE="https://github.com/${LOGS_FORK}/${LOGS_PROJECT_NAME}/tree/${LOGS_BRANCH}"
LOGS_GITHUB_HTTPS_SUBDIR="${LOGS_GITHUB_HTTPS_BASE}/${LOGS_LOCAL_SUBDIR}"
LOGS_GITHUB_HTTPS_RESULTS="${LOGS_GITHUB_HTTPS_SUBDIR}/results.log"

# The github git clone locations
GITHUB_PROTOCOL_GIT="git@github.com:"
GITHUB_PROTOCOL_HTTPS="https://github.com/"
HELM_GITHUB_GITCLONE_GIT="${GITHUB_PROTOCOL_GIT}${HELM_FORK}/helm-charts.git"
HELM_GITHUB_GITCLONE_HTTPS="${GITHUB_PROTOCOL_HTTPS}${HELM_FORK}/helm-charts.git"
KIALI_GITHUB_GITCLONE_GIT="${GITHUB_PROTOCOL_GIT}${KIALI_FORK}/kiali.git"
KIALI_GITHUB_GITCLONE_HTTPS="${GITHUB_PROTOCOL_HTTPS}${KIALI_FORK}/kiali.git"
KIALI_OPERATOR_GITHUB_GITCLONE_GIT="${GITHUB_PROTOCOL_GIT}${KIALI_OPERATOR_FORK}/kiali-operator.git"
KIALI_OPERATOR_GITHUB_GITCLONE_HTTPS="${GITHUB_PROTOCOL_HTTPS}${KIALI_OPERATOR_FORK}/kiali-operator.git"
LOGS_GITHUB_GITCLONE_GIT="${GITHUB_PROTOCOL_GIT}${LOGS_FORK}/${LOGS_PROJECT_NAME}.git"
LOGS_GITHUB_GITCLONE_HTTPS="${GITHUB_PROTOCOL_HTTPS}${LOGS_FORK}/${LOGS_PROJECT_NAME}.git"

# the libera IRC room where notifications are to be sent (allow the user to set this to "" via -ir option)
IRC_ROOM="${IRC_ROOM-kiali-molecule-tests}"

# Only if this is set to "true" will the logs be committed and pushed to the git repo
UPLOAD_LOGS="${UPLOAD_LOGS:-false}"

# Only if this is set to "true" will Istio be installed if it is missing
# The reduce resources flag is not used unless Istio will be installed.
INSTALL_ISTIO="${INSTALL_ISTIO:-true}"
REDUCE_RESOURCES="${REDUCE_RESOURCES:-false}"

# Determines if we should build and push dev images
USE_DEV_IMAGES="${USE_DEV_IMAGES:-false}"

# Determines what Kiali CR spec.version the tests should use
SPEC_VERSION="${SPEC_VERSION:-default}"

# Determines if image_name/image_version should be omitted from test Kiali CRs and OSSMConsole CRs
USE_DEFAULT_IMAGES="${USE_DEFAULT_IMAGES:-false}"

# print out our settings for debug purposes
cat <<EOM
=== SETTINGS ===
ALL_TESTS=$ALL_TESTS
DORP=$DORP
GIT_CLONE_PROTOCOL=$GIT_CLONE_PROTOCOL
HELM_BRANCH=$HELM_BRANCH
HELM_FORK=$HELM_FORK
INSTALL_ISTIO=$INSTALL_ISTIO
IRC_ROOM=$IRC_ROOM
KIALI_BRANCH=$KIALI_BRANCH
KIALI_FORK=$KIALI_FORK
KIALI_OPERATOR_BRANCH=$KIALI_OPERATOR_BRANCH
KIALI_OPERATOR_FORK=$KIALI_OPERATOR_FORK
KUBEADMIN_PW_FILE=$KUBEADMIN_PW_FILE
KUBEADMIN_USER=$KUBEADMIN_USER
LOGS_GITHUB_GITCLONE_GIT=$LOGS_GITHUB_GITCLONE_GIT
LOGS_GITHUB_GITCLONE_HTTPS=$LOGS_GITHUB_GITCLONE_HTTPS
LOGS_GITHUB_HTTPS_RESULTS=$LOGS_GITHUB_HTTPS_RESULTS
LOGS_GITHUB_HTTPS_SUBDIR=$LOGS_GITHUB_HTTPS_SUBDIR
LOGS_LOCAL_RESULTS=$LOGS_LOCAL_RESULTS
LOGS_LOCAL_SUBDIR=$LOGS_LOCAL_SUBDIR
LOGS_LOCAL_SUBDIR_ABS=$LOGS_LOCAL_SUBDIR_ABS
OC=$OC
OPERATOR_INSTALLER=$OPERATOR_INSTALLER
REDUCE_RESOURCES=$REDUCE_RESOURCES
SKIP_TESTS=$SKIP_TESTS
SPEC_VERSION=$SPEC_VERSION
SRC=$SRC
UPLOAD_LOGS=$UPLOAD_LOGS
USE_DEV_IMAGES=$USE_DEV_IMAGES
USE_DEFAULT_IMAGES=$USE_DEFAULT_IMAGES
=== SETTINGS ===
EOM

if [ "${GIT_CLONE_PROTOCOL}" == "git" ]; then
  HELM_GITHUB_GITCLONE="${HELM_GITHUB_GITCLONE_GIT}"
  KIALI_GITHUB_GITCLONE="${KIALI_GITHUB_GITCLONE_GIT}"
  KIALI_OPERATOR_GITHUB_GITCLONE="${KIALI_OPERATOR_GITHUB_GITCLONE_GIT}"
  LOGS_GITHUB_GITCLONE="${LOGS_GITHUB_GITCLONE_GIT}"
elif [ "${GIT_CLONE_PROTOCOL}" == "https" ]; then
  HELM_GITHUB_GITCLONE="${HELM_GITHUB_GITCLONE_HTTPS}"
  KIALI_GITHUB_GITCLONE="${KIALI_GITHUB_GITCLONE_HTTPS}"
  KIALI_OPERATOR_GITHUB_GITCLONE="${KIALI_OPERATOR_GITHUB_GITCLONE_HTTPS}"
  LOGS_GITHUB_GITCLONE="${LOGS_GITHUB_GITCLONE_HTTPS}"
  if [ "${UPLOAD_LOGS}" == "true" ]; then
    echo "The git clone protocol (-gcp) must be 'git' when upload logs is enabled (-ul true)."
    exit 1
  fi
else
  echo "The git clone protocol must be one of 'git' or 'https'. It was [${GIT_CLONE_PROTOCOL}]"
  exit 1
fi

infomsg "Create a clean github repo location"
if [ "${SRC}" == "" ]; then
  infomsg "SRC is empty - aborting"
  exit 1
fi
if [ "${LOGS_PROJECT_NAME}" == "" ]; then
  infomsg "LOGS_PROJECT_NAME is empty - aborting"
  exit 1
fi
test -d ${SRC}/helm-charts && rm -rf ${SRC}/helm-charts
test -d ${SRC}/kiali-operator && rm -rf ${SRC}/kiali-operator
test -d ${SRC}/kiali && rm -rf ${SRC}/kiali
test -d ${SRC}/${LOGS_PROJECT_NAME:-invalid} && [ "${SRC}/${LOGS_PROJECT_NAME}" != "/" ] && rm -rf ${SRC}/${LOGS_PROJECT_NAME:-invalid}
mkdir -p ${SRC}

infomsg "Make sure everything exists"
if [ -z "${KUBEADMIN_PW}" ]; then
  infomsg "Will read the kubeadmin pw file now [${KUBEADMIN_PW_FILE}] - if it cannot be read as the current user [$USER] another attempt via 'sudo' will be made"
  test -f ${KUBEADMIN_PW_FILE} || sudo test -f ${KUBEADMIN_PW_FILE} || (infomsg "kubeadmin password file [$KUBEADMIN_PW_FILE] is missing"; exit 1)
  KUBEADMIN_PW="$(cat ${KUBEADMIN_PW_FILE} || sudo cat ${KUBEADMIN_PW_FILE})"
fi

test -x $OC || (infomsg "OC executable [$OC] is missing"; exit 1)
test -d $SRC || (infomsg "Directory to git clone the repos [$SRC] is missing"; exit 1)
which $DORP > /dev/null || (infomsg "[$DORP] is not in the PATH"; exit 1)

infomsg "Clone github repos in [$SRC] to make sure we have the latest tests and scripts"

cd ${SRC}

infomsg "Cloning logs repo [${LOGS_FORK}/${LOGS_PROJECT_NAME}:${LOGS_BRANCH}] from [${LOGS_GITHUB_GITCLONE}]..."
git clone --single-branch --branch ${LOGS_BRANCH} ${LOGS_GITHUB_GITCLONE}

infomsg "Cloning helm-charts [${HELM_FORK}/helm-charts:${HELM_BRANCH}] from [${HELM_GITHUB_GITCLONE}]..."
git clone --single-branch --branch ${HELM_BRANCH} ${HELM_GITHUB_GITCLONE}

infomsg "Cloning kiali [${KIALI_FORK}/kiali:${KIALI_BRANCH}] from [${KIALI_GITHUB_GITCLONE}]..."
git clone --single-branch --branch ${KIALI_BRANCH} ${KIALI_GITHUB_GITCLONE}

infomsg "Cloning kiali-operator [${KIALI_OPERATOR_FORK}/kiali-operator:${KIALI_OPERATOR_BRANCH}] from [${KIALI_OPERATOR_GITHUB_GITCLONE}]..."
git clone --single-branch --branch ${KIALI_OPERATOR_BRANCH} ${KIALI_OPERATOR_GITHUB_GITCLONE}

ln -s ${SRC}/kiali-operator kiali/operator
cd kiali

infomsg "Log into the cluster [${OPENSHIFT_API}] as kubeadmin user named [${KUBEADMIN_USER}]"
$OC login -u ${KUBEADMIN_USER} -p ${KUBEADMIN_PW} ${OPENSHIFT_API}

if [ "${USE_DEV_IMAGES}" == "true" ]; then
  GOPATH="${GOPATH:-/tmp}"
  infomsg "Dev images are to be tested. Will prepare them now using GOPATH=${GOPATH}"

  infomsg "Building backend server and frontend UI..."
  make -e OC="${OC}" -e DORP="${DORP}" -e GOPATH="${GOPATH}" clean build test build-ui

  infomsg "Logging into the image registry..."
  eval $(make -e OC="${OC}" -e DORP="${DORP}" cluster-status | grep "Image Registry login:" | sed 's/Image Registry login: \(.*\)$/\1/')

  infomsg "Pushing the images into the cluster..."
  make -e OC="${OC}" -e DORP="${DORP}" -e GOPATH="${GOPATH}" cluster-push
else
  infomsg "Will test the latest published images"
fi

if [ "${OPERATOR_INSTALLER}" != "skip" ]; then
  infomsg "Cleaning any residual Kiali installs that might be hanging around"
  hack/purge-kiali-from-cluster.sh --client-exe "$OC"
else
  infomsg "Operator installation is being skipped so it is assumed you already have Kiali operator installed. No cleanup of residual Kiali installs will be performed. Make sure you do not have a Kiali CR installed - only the operator should be installed."
fi

if ! $OC get namespace istio-system > /dev/null; then
  if [ "${INSTALL_ISTIO}" == "true" ]; then
    if [ ! -z "${ISTIO_VERSION}" ]; then
      DOWNLOAD_ISTIO_VERSION_ARG="--istio-version ${ISTIO_VERSION}"
    fi
    hack/istio/download-istio.sh ${DOWNLOAD_ISTIO_VERSION_ARG}
    hack/istio/install-istio-via-istioctl.sh --client-exe-path "$OC" --reduce-resources "${REDUCE_RESOURCES}"
  else
    infomsg "There is no 'istio-system' namespace, and this script was told not to install Istio. Aborting."
    exit 1
  fi
else
  infomsg "There is an 'istio-system' namespace - assuming Istio is installed and ready."
fi

infomsg "Building the Molecule test docker image using [${DORP}]"
make -e FORCE_MOLECULE_BUILD="true" -e DORP="${DORP}" molecule-build

mkdir -p "${LOGS_LOCAL_SUBDIR_ABS}"
infomsg "Running the tests - logs are going here: ${LOGS_LOCAL_SUBDIR_ABS}"
eval hack/run-molecule-tests.sh $(test ! -z "$ALL_TESTS" && echo "--all-tests \"$ALL_TESTS\"") $(test ! -z "$SKIP_TESTS" && echo "--skip-tests \"$SKIP_TESTS\"") --use-dev-images "${USE_DEV_IMAGES}" --use-default-images "${USE_DEFAULT_IMAGES}" --spec-version "${SPEC_VERSION}" --helm-charts-repo "${SRC}/helm-charts" --client-exe "$OC" --color false --test-logs-dir "${LOGS_LOCAL_SUBDIR_ABS}" -dorp "${DORP}" --operator-installer "${OPERATOR_INSTALLER:-helm}" > "${LOGS_LOCAL_RESULTS}"

cd ${LOGS_LOCAL_SUBDIR_ABS}

# compress large log files
MAX_LOG_FILE_SIZE="50M"
for bigfile in $(find ${LOGS_LOCAL_SUBDIR_ABS} -maxdepth 1 -type f -size +${MAX_LOG_FILE_SIZE})
do
  infomsg "This file is large and needs to be compressed: $(basename ${bigfile})"
  tar -czf ${bigfile}.tgz -C ${LOGS_LOCAL_SUBDIR_ABS} --remove-files $(basename ${bigfile})
done

if [ "${UPLOAD_LOGS}" == "true" ]; then
  infomsg "Committing the logs to github: ${LOGS_GITHUB_HTTPS_SUBDIR}"
  git add -A
  git commit -m "Test results for ${LOGS_LOCAL_SUBDIR}"
  git push
else
  infomsg "The logs will not be uploaded. Test results can be found here: ${LOGS_LOCAL_SUBDIR_ABS}"
fi

# determine what message to send to IRC based on test results
if grep FAILURE "${LOGS_LOCAL_RESULTS}"; then
  irc_msg="a FAILURE occurred in [$(grep FAILURE "${LOGS_LOCAL_RESULTS}" | wc -l)] tests"
else
  irc_msg="all tests passed"
fi

if [ "${UPLOAD_LOGS}" == "true" ]; then
  irc_msg="kiali tests are done [${irc_msg}]: ${LOGS_GITHUB_HTTPS_RESULTS} (test logs directory: ${LOGS_GITHUB_HTTPS_SUBDIR})"
else
  irc_msg="kiali tests are done [${irc_msg}]: Logs were not uploaded. See the local machine directory: ${LOGS_LOCAL_SUBDIR_ABS}"
fi

if [ "${IRC_ROOM}" == "" ]; then
  infomsg "Not sending IRC notification - results are: ${irc_msg}"
else
  infomsg "Sending IRC notification to room [#${IRC_ROOM}]. msg=${irc_msg}"
  (
  echo 'NICK kiali-test-bot'
  echo 'USER kiali-test-bot 8 * : kiali-test-bot'
  sleep 10
  echo "JOIN #${IRC_ROOM}"
  sleep 5
  echo "PRIVMSG #${IRC_ROOM} : ${irc_msg}"
  echo QUIT
  ) | nc irc.libera.chat 6667
fi
