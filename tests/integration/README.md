# Kiali Integration Tests

### Project Structure

* `tests/integration/`:  Root directory
    *  `tests`:  Tests
    *  `utils`:  Support utilities


## Environment Setup

* System dependencies that will need to be available
    *  `oc`
    *  `make`
    *  `npm`
    *  `yarn`

* It is expected that the following have already been deployed in Openshift
    * `Istio-system (Istio, Grafana, Prometheus, etc.)`
    * `Kiali (Deployed into Istio-system namespace)`
    * `Bookinfo (with traffic generated to Bookinfo)`

```sh
# Clone this repository
$ git clone https://github.com/kiali/kiali.git

# Install requirements
$ make test-integration-setup

# Login to Openshift Cluster 
$ oc login https://<openshift>:<port> --username=<username> --password=<password> --insecure-skip-tls-verify=true

# Read the Token from Openshift Cluster, to be used in next step or running tests
$ oc whoami -t

# run all tests
$ make test-integration URL="https://<kiali-hostname>" TOKEN="<token>"

# test results are stored in "tests/integration/junit-rest-report.xml" file
```
## Run notes

* The Bookinfo namespace is cleaned of pre-existing Circuit Breakers and Virtual Services.
  Therefore, ignore any errors during the clean-up that follow the message:
    "Cleanning up (Note: ignore messages: "Error from server..."

