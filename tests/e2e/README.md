# Kiali E2E Tests

### Project Structure

* `tests/e2e/`: Root directory
    *  `tests`: Tests
    *  `utils`: Support utilities
    *  `conf`:  Environment configuration
    *  `assets`: Routing yaml's used by tests


## Environment Setup

* Dependencies that will need to be available prior to running this test suite
    *  `oc`
    *  `python 3.6`

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

# Update conf/env.yaml with kiali hostname and credentials

# Login to Openshift Cluster 
$ oc login https://<openshift>:8443 --username=<username> --password=<password> --insecure-skip-tls-verify=true

# run all tests
$ pytest -s tests/
```

