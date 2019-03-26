import pytest
import tests.conftest as conftest
from utils.command_exec import command_exec
from kiali import KialiClient


STRATEGY_LOGIN = 'login'
STRATEGY_ANONYMOUS = 'anonymous'
STRATEGY_OPENSHIFT = 'openshift'

AUTH_CREDENTIALS = 'https-user-password'
AUTH_NOAUTH = 'no-auth'

STRATEGY_LIST = ['login', 'anonymous', 'openshift']
WEB_ROOT_LIST = ['/']

def test_auth_anonymous():
    try:
        assert change_configmap_with_new_value(element_name='strategy:', list=STRATEGY_LIST,
            new_value=STRATEGY_ANONYMOUS, current_configmap_file=conftest.CURRENT_CONFIGMAP_FILE,
            new_configmap_file=conftest.NEW_CONFIG_MAP_FILE)

        assert do_auth_strategy_test(auth_type = AUTH_NOAUTH)

    finally:
        # Return Auth strategy back to 'login'
        create_configmap_and_wait_for_kiali(conftest.CURRENT_CONFIGMAP_FILE)

def test_change_web_root(kiali_client):
    new_web_root_value = '/e2e'

    try:
        assert change_configmap_with_new_value(element_name='web_root:', list=WEB_ROOT_LIST,
            new_value=new_web_root_value, current_configmap_file=conftest.CURRENT_CONFIGMAP_FILE,
            new_configmap_file=conftest.NEW_CONFIG_MAP_FILE)

        assert kiali_client.request(plain_url="e2e/api/namespaces", path=None, params=None)

    finally:
        # Return web_root back to '/'
        create_configmap_and_wait_for_kiali(conftest.CURRENT_CONFIGMAP_FILE)

##

def do_auth_strategy_test(auth_type):
    config = conftest.__get_environment_config__(conftest.ENV_FILE)
    swagger = config.get('kiali_swagger_address')
    hostname = config.get('kiali_hostname')

    if AUTH_NOAUTH in auth_type:
        kiali_client = KialiClient(hostname=hostname, auth_type=AUTH_NOAUTH, verify=False, swagger_address=swagger)
        response = kiali_client.request(method_name='namespaceList', path=None, params=None)

        # Make API call - expected to pass with no authentication
        assert response.status_code == 200, "Unexpected status code \'response.status_code\'"
    else:
        assert False, "To Do"

    return True

def change_configmap_with_new_value(element_name, list, new_value, current_configmap_file, new_configmap_file):

    assert command_exec().oc_get_kiali_configmap(file = current_configmap_file)

    create_new_configmap_file(element_name, list, new_value, current_configmap_file, new_configmap_file)
    create_configmap_and_wait_for_kiali(new_configmap_file)

    return True

def create_configmap_and_wait_for_kiali(configmap_file):

    assert command_exec().oc_delete_kiali_config_map()
    assert command_exec().oc_create_kiali_config_map(file = configmap_file)
    assert command_exec().oc_delete_kiali_pod()
    assert command_exec().oc_wait_for_kiali_state('Running')

def create_new_configmap_file(element_name, list, new_value, current_configmap_file_name, new_configmap_file):

    current_configmap_file = open(current_configmap_file_name, "r")
    new_configmap_file = open(new_configmap_file, "w")

    for line in current_configmap_file:
        if element_name in line:
            for item in list:
                if item in line:
                    line = line.replace(item, new_value)
                    break

        new_configmap_file.write(line)

    current_configmap_file.close()
    new_configmap_file.close()
