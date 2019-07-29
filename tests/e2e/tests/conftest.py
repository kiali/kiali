import os
import pytest
import yaml
import re
import requests
from kiali import KialiClient
from utils.command_exec import command_exec
from pkg_resources import resource_string
from urllib.request import urlopen

CONFIG_PATH = '../config'
ENV_FILE = CONFIG_PATH + '/env.yaml'
ASSETS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../assets')
CIRCUIT_BREAKER_FILE = ASSETS_PATH + '/bookinfo-reviews-all-cb.yaml'
VIRTUAL_SERVICE_FILE = ASSETS_PATH + '/bookinfo-ratings-delay.yaml'
WORKLOADS_FILE = ASSETS_PATH  + '/bookinfo-workloads.yaml'
EXTERNAL_HOST_SERVICE_FILE = ASSETS_PATH  + '//bookinfo-ext-service-entry.yaml'

CURRENT_CONFIGMAP_FILE = './current_kiali_configmap.yaml'
NEW_CONFIG_MAP_FILE = './new_kiali_configmap.yaml'

@pytest.fixture(scope='session')
def kiali_client():
    config = __get_environment_config__(ENV_FILE)
    __remove_assets()
    yield __get_kiali_client__(config)

def get_bookinfo_namespace():
    return __get_environment_config__(ENV_FILE).get('mesh_bookinfo_namespace')

def __get_kiali_client__(config):
    if(config.get('kiali_scheme') == 'https'):
       return KialiClient(hostname=config.get('kiali_hostname'), auth_type=config.get(
        'kiali_auth_method'), token=config.get('kiali_token'),
                       username=config.get('kiali_username'), password=config.get('kiali_password'), verify=config.get(
            'kiali_verify_ssl_certificate'), swagger_address=config.get('kiali_swagger_address'), custom_base_path=config.get('kiali_custom_base_context'))
    else:
        return KialiClient(hostname=config.get('kiali_hostname'), username=config.get('kiali_username'), password=config.get('kiali_password'),
        auth_type=config.get('kiali_auth_method'), swagger_address=config.get('kiali_swagger_address'), custom_base_path=config.get('kiali_custom_base_context'))

def __get_environment_config__(env_file):
    yamlfile = resource_string(__name__, env_file)
    config = yaml.safe_load(yamlfile)
    return config


def __remove_assets():
  print('Cleanning up (Note: ignore messages: "Error from server (NotFound))": ')
  namespace = get_bookinfo_namespace()
  file_count = 0
  for root, dirs, files in os.walk(ASSETS_PATH):
    file_count = len(files)

    for name in files:
      command_exec.oc_delete(ASSETS_PATH + "/" + name, namespace)

  print('Assets deleted: {}'.format(file_count))

def get_istio_clusterrole_file():
    file = __get_environment_config__(ENV_FILE).get('istio_clusterrole')
    yaml_content = urlopen(file).read().decode("utf-8")

    yaml_content = re.sub("app: {{.+}}", "app: kiali", yaml_content)
    yaml_content = re.sub("chart: {{.+}}", "version: 0.10 ", yaml_content)
    yaml_content = re.sub("heritage: {{.+}}\n", "", yaml_content)
    yaml_content = re.sub("release: {{.+}}", "", yaml_content)

    return next(yaml.safe_load_all(yaml_content))

def get_kiali_clusterrole_file(file_type):

    if(file_type == "Openshift"):
        file = __get_environment_config__(ENV_FILE).get('kiali_openshift_clusterrole')

    elif(file_type == "Kubernetes"):
        file = __get_environment_config__(ENV_FILE).get('kiali_kubernetes_clusterrole')

    yaml_content = urlopen(file).read()

    return next(yaml.safe_load_all(yaml_content))

def get_kiali_swagger_address():
    return __get_environment_config__(ENV_FILE).get('kiali_swagger_address')

def get_kiali_auth_method():
    return __get_environment_config__(ENV_FILE).get('kiali_auth_method')

def get_control_plane_namespace():
    return __get_environment_config__(ENV_FILE).get('control_plane_namespace')

def get_kiali_hostname():
    return __get_environment_config__(ENV_FILE).get('kiali_hostname')

def get_new_kiali_client():
    return __get_kiali_client__(__get_environment_config__(ENV_FILE))
