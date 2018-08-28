import pytest
import yaml
from kiali import KialiClient

ENV_FILE = './config/env.yaml'
CIRCUIT_BREAKER_FILE = 'assets/circuitbreaker.yaml'
VIRTUAL_SERVICE_FILE = 'assets/bookinfo-ratings-delay.yaml'

@pytest.fixture(scope="session")
def kiali_json():

    config = __get_environment_config__(ENV_FILE)
    client = __get_kiali_client__(config)

    return client.graph_namespace(namespace=config.get('mesh_bookinfo_namespace'),
                                  params={'duration': '1m'})

@pytest.fixture(scope='session')
def kiali_client():
    config = __get_environment_config__(ENV_FILE)
    return __get_kiali_client__(config)

def __get_kiali_client__(config):
    print "\nGet Kiali Client for Kiali hostname: {}\n".format(config.get('kiali_hostname'))
    return KialiClient(host=config.get('kiali_hostname'),
                       username=config.get('kiali_username'), password=config.get('kiali_password'))

def __get_environment_config__(env_file):
    with open(env_file) as yamlfile:
        config = yaml.load(yamlfile)
    return config
