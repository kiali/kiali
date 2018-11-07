import os
import pytest
import yaml
import ssl
from kiali import KialiClient
from utils.command_exec import command_exec

ENV_FILE = './config/env.yaml'
CIRCUIT_BREAKER_FILE = 'assets/bookinfo-reviews-all-cb.yaml'
VIRTUAL_SERVICE_FILE = 'assets/bookinfo-ratings-delay.yaml'

@pytest.fixture(scope="session")
def kiali_json():

    config = __get_environment_config__(ENV_FILE)
    client = __get_kiali_client__(config)

    return client.graph_namespaces(params={'duration': '1m', 'namespaces': config.get('mesh_bookinfo_namespace')})

@pytest.fixture(scope='session')
def kiali_client():
    config = __get_environment_config__(ENV_FILE)
    yield __get_kiali_client__(config)
    __remove_assets()

def get_bookinfo_namespace():
    return __get_environment_config__(ENV_FILE).get('mesh_bookinfo_namespace')

def __get_kiali_client__(config):
    if(config.get('kiali_ssl_enabled') is True):
        context = ssl._create_unverified_context()
        return KialiClient(host=config.get('kiali_hostname'), username=config.get('kiali_username'), password=config.get('kiali_password'), port=443, context=context, scheme='https')
    else:
        return KialiClient(host=config.get('kiali_hostname'),
                           username=config.get('kiali_username'), password=config.get('kiali_password'))

def __get_environment_config__(env_file):
    with open(env_file) as yamlfile:
        config = yaml.load(yamlfile)
    return config

def __remove_assets():
  print('Cleanning up: ')
  namespace = get_bookinfo_namespace()
  file_count = 0
  for root, dirs, files in os.walk('./assets'):
    file_count = len(files)

    for name in files:
      command_exec.oc_delete('./assets/' + name, namespace)

  print('Assets deleted: {}'.format(file_count))
