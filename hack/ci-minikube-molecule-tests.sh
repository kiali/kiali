#!/bin/bash

#
# This script is designed to be run via a cronjob so the latest Kiali images
# can be tested periodically using the molecule tests.
#
# This will start a minikube cluster via the hack script k8s-minikube.sh.
#

set -u

# Where this script is - all our hack files are assumed to be in here
script_root="$( cd "$(dirname "$0")" ; pwd -P )"
hack_dir="$script_root"

helpmsg() {
  cat <<HELP
This script will run the Kiali molecule tests in minikube.

You can use this as a cronjob to test Kiali periodically.

Options:

-at|--all-tests
    Space-separated list of all the molecule tests to be run.
    The default is all the tests found in the operator/molecule directory in the Kiali source home directory.

-ce|--client-exe <path to kubectl>
    The 'kubectl' command, if not in PATH then must be a full path.
    Default: kubectl

-dorp|--docker-or-podman <docker|podman>
    Container environment to use.
    Default: ${DORP:-docker}

-ir|--irc-room <irc room name>
    The libera IRC room to send the results message.
    Set to "" to not send any message.
    Default: kiali-molecule-tests

-lb|--logs-branch <branch name>
    The logs branch to clone.
    Only used if --upload-logs is "true", otherwise, this setting is ignored.
    Default: minikube

-ld|--logs-directory <path>
    The full path to the local git repository of the logs. This must exist and must be the git repo of the logs fork.
    Only used if --upload-logs is "true", otherwise, this setting is ignored.

-lf|--logs-fork <name>
    The logs fork/org to clone.
    Only used if --upload-logs is "true", otherwise, this setting is ignored.
    Default: jmazzitelli

-lpn|--logs-project-name <name>
    The project name within the logs fork/org to clone.
    Only used if --upload-logs is "true", otherwise, this setting is ignored.
    Default: kiali-molecule-test-logs

-me|--minikube-exe <path to minikube>
    The 'minikube' command, if not in PATH then must be a full path.
    Default: minikube

-oe|--olm-enabled <true|false>
    If true, install OLM into the cluster and test the operator as installed by OLM
    This has no effect if the cluster is already built. To ensure OLM is enabled,
    you can pass in "--rebuild-cluster true" to start a new cluster with OLM.
    Default: false

-rc|--rebuild-cluster <true|false>
    If true, any existing cluster will be destroyed and a new one will be rebuilt.
    Default: false

-ul|--upload-logs <true|false>
    If you want to upload the logs to the git repo, set this to true.
    If true, it is assumed there is a git repo cloned and located at
    --logs-directory and that is there the test logs will go. Those logs
    will then be pushed to the remote git repo.
    If false, the logs will just be written to a local tmp directory.
    Default: false
HELP
}

# process command line arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -at|--all-tests)              ALL_TESTS="$2";       shift;shift; ;;
    -ce|--client-exe)             CLIENT_EXE="$2";      shift;shift; ;;
    -dorp|--docker-or-podman)     DORP="$2";            shift;shift; ;;
    -ir|--irc-room)               IRC_ROOM="$2";        shift;shift; ;;
    -lb|--logs-branch)            LOGS_BRANCH="$2";     shift;shift; ;;
    -ld|--logs-directory)         LOGS_DIR="$2";        shift;shift; ;;
    -lf|--logs-fork)              LOGS_FORK="$2";       shift;shift; ;;
    -lpn|--logs-project-name)     LOGS_PROJECT_NAME="$2"; shift;shift; ;;
    -me|--minikube-exe)           MINIKUBE_EXE="$2";    shift;shift; ;;
    -oe|--olm-enabled)            OLM_ENABLED="$2";     shift;shift; ;;
    -rc|--rebuild-cluster)        REBUILD_CLUSTER="$2"; shift;shift; ;;
    -ul|--upload-logs)            UPLOAD_LOGS="$2";     shift;shift; ;;
    -h|--help)                    helpmsg; exit 1;      shift; ;;
    *) echo "Unknown argument: [$key]. Aborting."; helpmsg; exit 1 ;;
  esac
done

CLIENT_EXE="${CLIENT_EXE:-kubectl}"
DORP="${DORP:-docker}"
MINIKUBE_EXE="${MINIKUBE_EXE:-minikube}"
OLM_ENABLED="${OLM_ENABLED:-false}"
REBUILD_CLUSTER="${REBUILD_CLUSTER:-false}"

# details about the github repo where the logs are to be stored
LOGS_PROJECT_NAME="${LOGS_PROJECT_NAME:-kiali-molecule-test-logs}"
LOGS_FORK="${LOGS_FORK:-jmazzitelli}"
LOGS_BRANCH="${LOGS_BRANCH:-minikube}"

LOGS_LOCAL_DIRNAME_ABS="${LOGS_DIR:-}"
LOGS_LOCAL_SUBDIR="molecule-tests-$(date +'%Y-%m-%d_%H-%M-%S')"
LOGS_LOCAL_SUBDIR_ABS="${LOGS_LOCAL_DIRNAME_ABS}/${LOGS_LOCAL_SUBDIR}"
LOGS_LOCAL_RESULTS="${LOGS_LOCAL_SUBDIR_ABS}/results.log"
LOGS_GITHUB_HTTPS_BASE="https://github.com/${LOGS_FORK}/${LOGS_PROJECT_NAME}/tree/${LOGS_BRANCH}"
LOGS_GITHUB_HTTPS_SUBDIR="${LOGS_GITHUB_HTTPS_BASE}/${LOGS_LOCAL_SUBDIR}"
LOGS_GITHUB_HTTPS_RESULTS="${LOGS_GITHUB_HTTPS_SUBDIR}/results.log"

# the libera IRC room where notifications are to be sent (allow the user to set this to "" via -ir option)
IRC_ROOM="${IRC_ROOM-kiali-molecule-tests}"

# Only if this is set to "true" will the logs be committed and pushed to the git repo
UPLOAD_LOGS="${UPLOAD_LOGS:-false}"
if [ "${UPLOAD_LOGS}" == "true" ]; then
  if [ -z "${LOGS_DIR:-}" -o ! -d "${LOGS_DIR:-}" ]; then
    echo "Specify a valid directory via --logs-directory - this must be where the logs project is git cloned. [${LOGS_DIR:-}]"
    exit 1
  fi
  if [ "${LOGS_PROJECT_NAME}" == "" -o "${LOGS_FORK}" == "" -o "${LOGS_BRANCH}" == "" ]; then
    echo "Invalid logs settings."
    exit 1
  fi
fi

# the minikube hack script command
minikube_profile="ci"
minikube_sh="${hack_dir}/k8s-minikube.sh --minikube-profile ${minikube_profile} --minikube-exe ${MINIKUBE_EXE} --client-exe ${CLIENT_EXE}"

if [ "${REBUILD_CLUSTER}" == "true" ]; then
  echo "Destroying any existing cluster to ensure a new one will be rebuilt."
  ${minikube_sh} delete
fi

# make sure we switch contexts if we can so we are pointing to the current cluster
if [ "$(${CLIENT_EXE} config current-context)" != "${minikube_profile}" ]; then
  if ! ${CLIENT_EXE} config use-context ${minikube_profile}; then
    echo "There is no kubectl context named [${minikube_profile}]. This likely means we will start one next."
  fi
fi

if [ "${OLM_ENABLED}" == "true" ]; then
  operator_installer_arg="--operator-installer skip"
  olm_enabled_arg="--olm-enabled true"
else
  operator_installer_arg="--operator-installer helm"
  olm_enabled_arg="--olm-enabled false"
fi

if [ "${ALL_TESTS:-}" == "" ]; then
  echo "Will run all tests"
else
  echo "Will only run tests: ${ALL_TESTS}"
fi

if ! ${minikube_sh} status; then

  ${minikube_sh} start --hydra-enabled true ${olm_enabled_arg}
  if ! ${minikube_sh} status; then
    echo "Failed to install the minikube cluster."
    exit 1
  fi
  ${minikube_sh} istio

  if [ "${OLM_ENABLED}" == "true" ]; then
    echo "Installing Kiali Operator"
    ${CLIENT_EXE} create -f https://operatorhub.io/install/stable/kiali.yaml

    echo -n "Waiting for Kiali CRD to be created."
    timeout 10m bash -c "until ${CLIENT_EXE} get crd kialis.kiali.io &> /dev/null; do echo -n '.' ; sleep 3; done"
    echo

    echo "Waiting for Kiali CRD to be established."
    ${CLIENT_EXE} wait --for condition=established --timeout=300s crd kialis.kiali.io

    echo -n "Waiting for the Kiali operator to be created."
    timeout 10m bash -c "until ${CLIENT_EXE} get deployments --all-namespaces | grep kiali-operator &> /dev/null; do echo -n '.' ; sleep 3; done"
    echo

    echo "Configuring the Kiali operator to allow ad hoc images and ad hoc namespaces and security context override."
    operator_namespace="$(${CLIENT_EXE} get deployments --all-namespaces | grep kiali-operator | cut -d ' ' -f 1)"
    for env_name in ALLOW_AD_HOC_KIALI_NAMESPACE ALLOW_AD_HOC_KIALI_IMAGE ALLOW_SECURITY_CONTEXT_OVERRIDE; do
      ${CLIENT_EXE} -n ${operator_namespace} patch $(${CLIENT_EXE} -n ${operator_namespace} get csv -o name | grep kiali) --type=json -p "[{'op':'replace','path':"/spec/install/spec/deployments/0/spec/template/spec/containers/0/env/$(${CLIENT_EXE} -n ${operator_namespace} get $(${CLIENT_EXE} -n ${operator_namespace} get csv -o name | grep kiali) -o jsonpath='{.spec.install.spec.deployments[0].spec.template.spec.containers[0].env[*].name}' | tr ' ' '\n' | cat --number | grep ${env_name} | cut -f 1 | xargs echo -n | cat - <(echo "-1") | bc)/value",'value':"\"true\""}]"
    done

    echo "Waiting for the Kiali Operator to be ready."
    ${CLIENT_EXE} wait -n ${operator_namespace} --for=condition=ready --timeout=300s $(${CLIENT_EXE} get pod -n ${operator_namespace} -l app.kubernetes.io/name=kiali-operator -o name)
  fi
else
  ${minikube_sh} resetclock
fi

if [ "${UPLOAD_LOGS}" == "true" ]; then
  cd "${LOGS_LOCAL_DIRNAME_ABS}"
  if ! git checkout ${LOGS_BRANCH}; then echo "Cannot checkout logs branch [${LOGS_BRANCH}]"; exit 1; fi
  if ! git pull; then echo "Cannot pull logs branch [${LOGS_BRANCH}]"; exit 1; fi
  mkdir -p "${LOGS_LOCAL_SUBDIR_ABS}"
  echo "Test logs are going to this git repo and will be pushed to branch [${LOGS_BRANCH}]: ${LOGS_LOCAL_SUBDIR_ABS}"
  test_logs_dir_arg="--test-logs-dir ${LOGS_LOCAL_SUBDIR_ABS}"
  redirect_output_to="${LOGS_LOCAL_RESULTS}"
else
  test_logs_dir_arg=""
  redirect_output_to="/dev/stdout"
fi

# Run the tests!
${hack_dir}/run-molecule-tests.sh --cluster-type minikube --minikube-profile ${minikube_profile} --color false --minikube-exe ${MINIKUBE_EXE} --client-exe ${CLIENT_EXE} -dorp ${DORP} --all-tests "${ALL_TESTS:-}" ${operator_installer_arg} ${test_logs_dir_arg} > ${redirect_output_to}

# Upload the logs if requested
if [ "${UPLOAD_LOGS}" == "true" ]; then
  cd ${LOGS_LOCAL_SUBDIR_ABS}

  # compress large log files
  MAX_LOG_FILE_SIZE="50M"
  for bigfile in $(find ${LOGS_LOCAL_SUBDIR_ABS} -maxdepth 1 -type f -size +${MAX_LOG_FILE_SIZE})
  do
    echo "This file is large and needs to be compressed: $(basename ${bigfile})"
    tar -czf ${bigfile}.tgz -C ${LOGS_LOCAL_SUBDIR_ABS} --remove-files $(basename ${bigfile})
  done

  echo "Committing the logs to github: ${LOGS_GITHUB_HTTPS_SUBDIR}"
  cd "${LOGS_LOCAL_SUBDIR_ABS}"
  git add -A
  git commit -m "Test results for ${LOGS_LOCAL_SUBDIR}"
  git push

  # dump the results to stdout
  cat "${LOGS_LOCAL_RESULTS}"
fi

# determine what message to send to IRC based on test results (only know this if uploading logs)
if [ -f "${LOGS_LOCAL_RESULTS}" ]; then
  if grep FAILURE "${LOGS_LOCAL_RESULTS}"; then
    irc_msg="a FAILURE occurred in [$(grep FAILURE "${LOGS_LOCAL_RESULTS}" | wc -l)] tests"
  else
    irc_msg="all tests passed"
  fi
else
  irc_msg="check local output for test results"
fi

if [ "${UPLOAD_LOGS}" == "true" ]; then
  irc_msg="kiali tests are done [${irc_msg}]: ${LOGS_GITHUB_HTTPS_RESULTS} (test logs directory: ${LOGS_GITHUB_HTTPS_SUBDIR})"
else
  irc_msg="kiali tests are done [${irc_msg}]: Logs were not uploaded. See the local machine for logs."
fi

if [ "${IRC_ROOM}" == "" ]; then
  echo "Not sending IRC notification - results are: ${irc_msg}"
else
  echo "Sending IRC notification to room [#${IRC_ROOM}]. msg=${irc_msg}"
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
