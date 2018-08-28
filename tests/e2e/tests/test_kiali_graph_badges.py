import os
import conftest
from utils.timeout import timeout
import time

DURATION = '60s'
VERSIONED_APP_PARAMS = {'graphType': 'versionedApp', 'duration': DURATION}
WORKLOAD_PARAMS      = {'graphType': 'workload', 'duration': DURATION}

CB_BADGE = 'hasCB'
VS_BADGE = "hasVS"

def test_kiali_circuit_breakers_versioned_app(kiali_client):
    assert do_test(kiali_client, VERSIONED_APP_PARAMS, conftest.CIRCUIT_BREAKER_FILE, CB_BADGE)

def test_kiali_circuit_breakers_workload(kiali_client):
    assert do_test(kiali_client, WORKLOAD_PARAMS, conftest.CIRCUIT_BREAKER_FILE, CB_BADGE)

def test_kiali_virtual_service_versioned_app(kiali_client):
    assert do_test(kiali_client, VERSIONED_APP_PARAMS, conftest.VIRTUAL_SERVICE_FILE, VS_BADGE)

def test_kiali_virtual_service_workload(kiali_client):
    assert do_test(kiali_client, WORKLOAD_PARAMS, conftest.VIRTUAL_SERVICE_FILE, VS_BADGE)


def do_test(kiali_client, graph_params, yaml_file, badge):
    environment_configmap = conftest.__get_environment_config__(conftest.ENV_FILE)
    bookinfo_namespace = environment_configmap.get('mesh_bookinfo_namespace')

    appType = kiali_client.graph_namespace(namespace=bookinfo_namespace, params=graph_params)['graphType']
    assert appType == graph_params.get('graphType')

    count = get_badge_count(kiali_client, bookinfo_namespace, graph_params, badge)

    add_command_text = "oc apply -n " + bookinfo_namespace + " -f " + os.path.abspath(os.path.realpath(yaml_file))
    add_command_result = os.popen(add_command_text).read()
    assert add_command_result.__contains__("created") or add_command_result.__contains__("configured")

    graph = kiali_client.graph_namespace(namespace=bookinfo_namespace, params=graph_params)
    assert graph is not None

    with timeout(seconds=60, error_message='Timed out waiting for Create'):
        while True:
            new_count = get_badge_count(kiali_client, bookinfo_namespace, graph_params, badge)
            if new_count != 0 and new_count >= count:
                break

            time.sleep(1)

    delete_command_text = "oc delete -n " + bookinfo_namespace + " -f " + os.path.abspath(os.path.realpath(yaml_file))
    delete_command_result = os.popen(delete_command_text).read()
    assert delete_command_result.__contains__("deleted")

    with timeout(seconds=30, error_message='Timed out waiting for Delete'):
        while True:
            # Validate that JSON no longer has Virtual Service
            if get_badge_count(kiali_client, bookinfo_namespace, graph_params, badge) <= count:
                break

            time.sleep(1)

    return True

def get_badge_count(kiali_client, namespace, graph_params, badge):

    nodes = kiali_client.graph_namespace(namespace=namespace, params=graph_params)["elements"]['nodes']
    assert nodes is not None

    count = 0
    for node in nodes:
        if badge in node["data"] and node["data"][badge]:
            count = count + 1

    return count
