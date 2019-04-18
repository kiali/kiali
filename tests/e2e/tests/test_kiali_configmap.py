import pytest
import tests.conftest as conftest
import time
from subprocess import PIPE, Popen
from kiali import KialiClient
from utils.command_exec import command_exec
from utils.timeout import timeout


STRATEGY_LOGIN = 'login'
STRATEGY_ANONYMOUS = 'anonymous'
STRATEGY_OPENSHIFT = 'openshift'

AUTH_NOAUTH = 'no-auth'
AUTH_LOGIN = "https-user-password"

STRATEGY_LIST = ['login', 'anonymous', 'openshift']
WEB_ROOT_LIST = ['/']

def _test_auth_anonymous():
    try:
        assert change_configmap_with_new_value(element_name='strategy:', list=STRATEGY_LIST,
            new_value=STRATEGY_ANONYMOUS, current_configmap_file=conftest.CURRENT_CONFIGMAP_FILE,
            new_configmap_file=conftest.NEW_CONFIG_MAP_FILE)

        assert make_request(auth_type = AUTH_NOAUTH)

    finally:
        # Return Auth strategy back to 'login'
        create_configmap_and_wait_for_kiali(conftest.CURRENT_CONFIGMAP_FILE)
        make_request(auth_type = AUTH_LOGIN)

def _test_auth_openshift():

    kiali_hostname = conftest.get_kiali_hostname()
    cookie_file = "./tmp_cookie_file"

    try:
        assert change_configmap_with_new_value(element_name='strategy:', list=STRATEGY_LIST,
            new_value=STRATEGY_OPENSHIFT, current_configmap_file=conftest.CURRENT_CONFIGMAP_FILE,
            new_configmap_file=conftest.NEW_CONFIG_MAP_FILE)

        # Create token cookie file
        cmd = "curl -v -k POST -c {} -d 'access_token='$(oc whoami -t)'&expires_in=86400&scope=user%3Afull&token_type=Bearer' https://{}/api/authenticate".format(cookie_file,  kiali_hostname)
        with timeout(seconds=120, error_message='Timed out waiting getting token'):
            while True:
                stdout, stderr = Popen(cmd, shell=True, stdout=PIPE, stderr=PIPE).communicate()
                if 'username' in stdout.decode():
                    break

                time.sleep(2)

        # Make the API request using token cookie
        cmd = "curl -v -k -b {} https://{}/api/namespaces".format(cookie_file, kiali_hostname)
        with timeout(seconds=120, error_message='Timed out waiting getting token'):
            while True:
                stdout, stderr = Popen(cmd, shell=True, stdout=PIPE, stderr=PIPE).communicate()
                if "istio-system" in stdout.decode():
                    break

                time.sleep(2)

        cmd = "rm -f {}".format(cookie_file)
        Popen(cmd, shell=True, stdout=PIPE, stderr=PIPE).communicate()

    finally:
        # Return Auth strategy back to 'login' and wait for Kiali to be accessible
        create_configmap_and_wait_for_kiali(conftest.CURRENT_CONFIGMAP_FILE)
        make_request(auth_type = AUTH_LOGIN)


def __test_change_web_root(kiali_client):
    new_web_root_value = '/e2e'

    try:
        assert change_configmap_with_new_value(element_name='web_root:', list=WEB_ROOT_LIST,
            new_value=new_web_root_value, current_configmap_file=conftest.CURRENT_CONFIGMAP_FILE,
            new_configmap_file=conftest.NEW_CONFIG_MAP_FILE)

        with timeout(seconds=180, error_message='Timed out waiting for API call'):
            while True:
                response = kiali_client.request(plain_url=new_web_root_value + "/api/namespaces", path=None, params=None)
                if response.status_code == 200:
                    break

                time.sleep(2)
    finally:
        # Return web_root back to '/'
        create_configmap_and_wait_for_kiali(conftest.CURRENT_CONFIGMAP_FILE)

##

def make_request(auth_type="auth"):

    with timeout(seconds=180, error_message='Timed out waiting for API call to complete'):
        while True:
            if auth_type == AUTH_LOGIN:
                kiali_client = conftest.get_new_kiali_client()
                response = kiali_client.request(method_name='namespaceList', path=None, params=None)
            elif auth_type == AUTH_NOAUTH:
                kiali_client = KialiClient(hostname=conftest.get_kiali_hostname(), auth_type=AUTH_NOAUTH, verify=False,
                                           swagger_address=conftest.get_kiali_swagger_address())
                response = kiali_client.request(method_name='namespaceList', path=None, params=None)
            else:
                assert False, "Error: Unsupported Auth Strategy Type: {}".format(auth_type)

            if response.status_code == 200:
                break

            time.sleep(2)

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
