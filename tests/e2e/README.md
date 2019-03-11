# Kiali E2E Tests

### Project Structure

* `tests/e2e/`:  Root directory
    *  `tests`:  Tests
    *  `utils`:  Support utilities
    *  `config`: Environment configuration
    *  `assets`: Routing yaml's used by tests


## Environment Setup

* System dependencies that will need to be available
    *  `oc`
    *  `python 3.6`

* It is expected that the following have already been deployed in Openshift
    * `Istio-system (Istio, Grafana, Prometheus, etc.)`
    * `Kiali (Deployed into Istio-system namespace)`
    * `Bookinfo`

```sh
# Clone this repository
$ git clone https://github.com/kiali/kiali.git
$ cd tests/e2e/

# Create virtual environment
$ virtualenv .env-e2e

# Enable virtual environment
$ source .env-e2e/bin/activate

# Install requirements
$ pip install -U pip
$ pip install -r requirements.txt

# Update config/env.yaml with kiali hostname and credentials

# Login to Openshift Cluster 
$ oc login https://<openshift>:8443 --username=<username> --password=<password> --insecure-skip-tls-verify=true

# run API tests
$ pytest tests/test_api_methods.py

# run all tests
$ pytest -s tests/
```

