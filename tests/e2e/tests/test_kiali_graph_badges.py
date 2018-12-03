import tests.conftest as conftest
from utils.timeout import timeout
from utils.command_exec import command_exec
import time

DURATION = '60s'
VERSIONED_APP_PARAMS = {'graphType': 'versionedApp', 'duration': DURATION, 'injectServiceNodes': 'true'}
WORKLOAD_PARAMS      = {'graphType': 'workload', 'duration': DURATION, 'injectServiceNodes': 'true'}
APP_PARAMS           = {'graphType': 'app', 'duration': DURATION, 'injectServiceNodes': 'true'}

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

def test_kiali_virtual_service_app(kiali_client):
    assert do_test(kiali_client, APP_PARAMS, conftest.VIRTUAL_SERVICE_FILE, VS_BADGE)

def do_test(kiali_client, graph_params, yaml_file, badge):
    bookinfo_namespace = conftest.get_bookinfo_namespace()
    graph_params["namespaces"] = bookinfo_namespace

    print("Debug: Start do_test: JSON: {}".format(get_graph_json(kiali_client, graph_params)))

    count = get_badge_count(kiali_client, graph_params, badge)

    try:
      assert command_exec.oc_apply(yaml_file, bookinfo_namespace) == True

      try:
        with timeout(seconds=60, error_message='Timed out waiting for Create'):
          while True:
              new_count = get_badge_count(kiali_client, graph_params, badge)
              if new_count != 0 and new_count >= count:
                  break

              time.sleep(1)
      except:
        print ("Timeout Exception - Nodes: {}".format(get_graph_json(kiali_client, graph_params)["elements"]['nodes']))
        raise Exception("Timeout - Waiting for badge: {}".format(badge))

    finally:
      assert command_exec.oc_delete(yaml_file, bookinfo_namespace) == True

      with timeout(seconds=60, error_message='Timed out waiting for Delete'):
          while True:
              # Validate that JSON no longer has Virtual Service
              if get_badge_count(kiali_client, graph_params, badge) <= count:
                  break

              time.sleep(1)

    return True

def get_badge_count(kiali_client, graph_params, badge):
    count = 0

    json = get_graph_json(kiali_client, graph_params)
    for node in json["elements"]['nodes']:
        if badge in node["data"] and node["data"][badge]:
            count = count + 1

    return count

def get_graph_json(kiali_client, graph_params):
    response = kiali_client.request(method_name='graphNamespaces', params=graph_params)
    assert response.status_code == 200
    return response.json()