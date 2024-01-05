# Kiali Integration Tests

## Project Structure

* `tests/integration/`:  Root directory
    *  `tests`:  Tests
    *  `utils`:  Support utilities


## Environment Setup

* System dependencies that will need to be available
    *  `oc` or `kubectl`
    *  `go`
    *  `make`
    *  `npm`
    *  `yarn`

* It is expected that the following have already been deployed in a OpenShift or non-OpenShift cluster:
    * Istio (Deployed into `istio-system` namespace, also including Grafana, Prometheus, etc.)
    * Kiali (Deployed into `istio-system` namespace)
    * Bookinfo (with traffic generated to Bookinfo)

### Useful hack scripts

You can use the following to help setup the environment if you do not already have one as detailed above.

* `hack/istio/install-istio-via-istioctl.sh`
    * Installs the latest Istio release into `istio-system` namespace along with the Prometheus, Grafana, and Jaeger addons.

* `hack/istio/install-bookinfo-demo.sh`
    * Installs the Bookinfo demo that is found in the Istio release that was installed via the `hack/istio/install-istio-via-istioctl.sh` hack script.
    * Pass in `-tg` to also install a traffic generator that will send messages periodically into the Bookinfo demo.
    * If using Minikube and the `-tg` option, make sure you pass in the Minikube profile name via `-mp` if the profile name is not `minikube`.

* Make targets to install Kiali
    * You must have a development environment on your local machine. Clone the kiali/kiali, kiali/kiali-operator, and kiali/helm-chart repos per the dev docs.
    * If using OpenShift:
        * You must first be logged into the OpenShift cluster via `oc login`.
        * Log into the internal image registry via podman or docker. Run `make cluster-status` and look in the output for the login command to use.
        * Run `make build build-ui cluster-push operator-create kiali-create`
    * If using Minikube:
        * Run `make -e CLUSTER_TYPE=minikube build build-ui cluster-push operator-create kiali-create`
        * If your Minikube profile name is not the default `minikube`, you must also pass in the env var `-e MINIKUBE_PROFILE="<your profile name>"`

* `hack/run-integration-tests.sh`
    * Does all the work for you by setting up a local kind cluster and running the test suite against that enviornment.

## Run the integration tests

### OpenShift

```sh
# Clone this repository if you do not yet have it
$ git clone https://github.com/kiali/kiali.git

# Login to Openshift Cluster - you must specify your OpenShift cluster information and credentials
$ oc login https://<openshift>:<port> --username=<username> --password=<password> --insecure-skip-tls-verify=true

# Run all tests using the Kiali Route and authenticated as the user that is logged in
$ make test-integration -e URL="https://$(oc get route -n istio-system kiali -o 'jsonpath={.spec.host}')" -e TOKEN="$(oc whoami -t)"

# test results are stored in the "tests/integration/junit-rest-report.xml" file
```

### Minikube

```sh
# Clone this repository if you do not yet have it
$ git clone https://github.com/kiali/kiali.git

# In a separate console, run a port-forward proxy to the Kiali running in the cluster
$ kubectl -n istio-system port-forward $(kubectl -n istio-system get pod -l app.kubernetes.io/name=kiali -o name) 20001:20001

# Run all tests using the Kiali port-forward proxy and authenticated as the Kiali service account
$ make test-integration -e CLIENT_EXE="kubectl" -e URL="http://localhost:20001/kiali" -e TOKEN="$(kubectl get -n istio-system $(kubectl get secret -n istio-system -o name | grep 'kiali.*-token' | head -n 1) -o jsonpath={.data.token} | base64 -d)"

# test results are stored in the "tests/integration/junit-rest-report.xml" file
```

## Running tests in a container
You can also run the test suite in a container, using the image `quay.io/kiali/kiali-int-tests:v1.73`.
System dependencies are bundled in the container but you are still required to install istio + kiali + bookinfo in advance.
Following environment variables are expected:
- `OCP_API_URL` - The URL of the OpenShift API server.
- `TOKEN` - The OCP API TOKEN.


To run the container:
```console
podman run -it \
  -e OCP_API_URL=https://api.test-cluter.test.com:6443 \
  -e TOKEN=<token> \
  quay.io/kiali/kiali-int-tests:v1.73
```


## Run notes

* The Bookinfo namespace is cleaned of pre-existing Circuit Breakers and Virtual Services.
  Therefore, ignore any errors during the clean-up that follow the message:
    "Cleanning up (Note: ignore messages: "Error from server..."

