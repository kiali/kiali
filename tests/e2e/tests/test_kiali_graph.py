import tests.conftest as conftest
import re

APP_BASE                   = {'graphType':'app', 'duration':'60s'}
APP_NO_LABELS              = {'graphType':'app', 'edges':'noEdgeLabels', 'duration':'60s'}
APP_REQUESTS_PER_SECOND    = {'graphType':'app', 'edges':'requestsPerSecond', 'duration':'60s'}
APP_REQUESTS_PERCENTAGE    = {'graphType':'app', 'edges':'requestsPercentage', 'duration':'60s'}
APP_REQUESTS_RESPONCE_TIME = {'graphType':'app', 'edges':'responseTime', 'duration':'60s'}
APP_INJECT_SERVICE_NODES_TRUE  = {'graphType':'app', 'edges':'responseTime', 'duration':'60s', 'injectServiceNodes' : 'true'}
APP_INJECT_SERVICE_NODES_FALSE = {'graphType':'app', 'edges':'responseTime', 'duration':'60s', 'injectServiceNodes' : 'false'}
APP_APPENDERS_BLANK        = {'graphType':'app', 'duration':'60s', 'appenders' : ''}
APP_APPENDERS_INVALID      = {'graphType':'app', 'duration':'60s', 'appenders' : 'invalid'}

SERVICE_BASE                   = {'graphType':'service', 'duration':'300s'}
SERVICE_NO_LABELS              = {'graphType':'service', 'edges':'noEdgeLabels', 'duration':'300s'}
SERVICE_REQUESTS_PER_SECOND    = {'graphType':'service', 'edges':'requestsPerSecond', 'duration':'300s'}
SERVICE_REQUESTS_PERCENTAGE    = {'graphType':'service', 'edges':'requestsPercentage', 'duration':'300s'}
SERVICE_REQUESTS_RESPONCE_TIME = {'graphType':'service', 'edges':'responseTime', 'duration':'300s'}
SERVICE_INJECT_SERVICE_NODES_TRUE  = {'graphType':'service', 'edges':'responseTime', 'duration':'60s', 'injectServiceNodes' : 'true'}
SERVICE_INJECT_SERVICE_NODES_FALSE = {'graphType':'service', 'edges':'responseTime', 'duration':'60s', 'injectServiceNodes' : 'false'}
SERVICE_APPENDERS_BLANK        = {'graphType':'service', 'duration':'60s', 'appenders' : ''}

VERSIONED_APP_BASE                   = {'graphType':'versionedApp', 'duration':'600s'}
VERSIONED_APP_NO_LABELS              = {'graphType':'versionedApp', 'edges':'noEdgeLabels', 'duration':'600s'}
VERSIONED_APP_REQUESTS_PER_SECOND    = {'graphType':'versionedApp', 'edges':'requestsPerSecond', 'duration':'600s'}
VERSIONED_APP_REQUESTS_PERCENTAGE    = {'graphType':'versionedApp', 'edges':'requestsPercentage', 'duration':'600s'}
VERSIONED_APP_REQUESTS_RESPONCE_TIME = {'graphType':'versionedApp', 'edges':'responseTime', 'duration':'600s'}
VERSIONED_INJECT_SERVICE_NODES_TRUE  = {'graphType':'versionedApp', 'edges':'responseTime', 'duration':'60s', 'injectServiceNodes' : 'true'}
VERSIONED_INJECT_SERVICE_NODES_FALSE = {'graphType':'versionedApp', 'edges':'responseTime', 'duration':'60s', 'injectServiceNodes' : 'false'}
VERSIONED_APPENDERS_BLANK            = {'graphType':'versionedApp', 'duration':'60s', 'appenders' : ''}

WORKLOAD_BASE                   = {'graphType':'workload', 'duration':'21600s'}
WORKLOAD_NO_LABELS              = {'graphType':'workload', 'edges':'noEdgeLabels', 'duration':'21600s'}
WORKLOAD_REQUESTS_PER_SECOND    = {'graphType':'workload', 'edges':'requestsPerSecond', 'duration':'21600s'}
WORKLOAD_REQUESTS_PERCENTAGE    = {'graphType':'workload', 'edges':'requestsPercentage', 'duration':'21600s'}
WORKLOAD_REQUESTS_RESPONCE_TIME = {'graphType':'workload', 'edges':'responseTime', 'duration':'21600s'}
WORKLOAD_APPENDERS_BLANK        = {'graphType':'workload', 'duration':'60s', 'appenders' : ''}

IDLE_EDGES = {'graphType':'versionedApp', 'duration':'300s', 'idleEdges':'true'}
IDLE_NODES = {'graphType':'versionedApp', 'duration':'300s', 'idleNodes':'true'}

OPERATION_NODES  = {'graphType':'versionedApp', 'duration':'300s', 'operationNodes':'true'}
SERVICE_NODES    = {'graphType':'versionedApp', 'duration':'300s', 'injectServiceNodes':'true'}

REFRESH_RATE = {'graphType':'versionedApp', 'duration':'300s', 'refresh':'15000'}

BOX_BY_LIST = {'cluster', 'namespace', 'app'}


def test_app_no_labels(kiali_client):
    json = get_graph_json(client = kiali_client, params = APP_NO_LABELS)
    validate_responce(json, APP_NO_LABELS)

def test_app_requests_per_second(kiali_client):
    json = get_graph_json(client = kiali_client, params = APP_REQUESTS_PER_SECOND)
    validate_responce(json, APP_REQUESTS_PER_SECOND)

def test_app_requests_percentage(kiali_client):
    json = get_graph_json(client = kiali_client, params = APP_REQUESTS_PERCENTAGE)
    validate_responce(json, APP_REQUESTS_PERCENTAGE)

def test_app_requests_responce_time(kiali_client):
    json = get_graph_json(client = kiali_client, params = APP_REQUESTS_RESPONCE_TIME)
    validate_responce(json, APP_REQUESTS_RESPONCE_TIME)

def test_app_box_by(kiali_client):
    validate_box_by(kiali_client, params = APP_BASE)

def test_service_no_labels(kiali_client):
    json = get_graph_json(client = kiali_client, params = SERVICE_NO_LABELS)
    validate_responce(json, SERVICE_NO_LABELS)

def test_service_requests_per_second(kiali_client):
    json = get_graph_json(client = kiali_client, params = SERVICE_REQUESTS_PER_SECOND)
    validate_responce(json, SERVICE_REQUESTS_PER_SECOND)

def test_service_requests_percentage(kiali_client):
    json = get_graph_json(client = kiali_client, params = SERVICE_REQUESTS_PERCENTAGE)
    validate_responce(json, SERVICE_REQUESTS_PERCENTAGE)

def test_service_requests_responce_time(kiali_client):
    json = get_graph_json(client = kiali_client, params = SERVICE_REQUESTS_RESPONCE_TIME)
    validate_responce(json, SERVICE_REQUESTS_RESPONCE_TIME)

def test_service_box_by(kiali_client):
    validate_box_by(kiali_client, params = SERVICE_BASE)

def test_versioned_app_no_labels(kiali_client):
    json = get_graph_json(client = kiali_client, params = VERSIONED_APP_NO_LABELS)
    validate_responce(json, VERSIONED_APP_NO_LABELS)

def test_versioned_app_requests_per_second(kiali_client):
    json = get_graph_json(client = kiali_client, params = VERSIONED_APP_REQUESTS_PER_SECOND)
    validate_responce(json, VERSIONED_APP_REQUESTS_PER_SECOND)

def test_versioned_app_requests_percentage(kiali_client):
    json = get_graph_json(client = kiali_client, params = VERSIONED_APP_REQUESTS_PERCENTAGE)
    validate_responce(json, VERSIONED_APP_REQUESTS_PERCENTAGE)

def test_versioned_app_requests_responce_time(kiali_client):
    json = get_graph_json(client = kiali_client, params = VERSIONED_APP_REQUESTS_RESPONCE_TIME)
    validate_responce(json, VERSIONED_APP_REQUESTS_RESPONCE_TIME)

def test_versioned_app_box_by(kiali_client):
    validate_box_by(kiali_client, params = VERSIONED_APP_BASE)

def test_workload_no_labels(kiali_client):
    json = get_graph_json(client = kiali_client, params = WORKLOAD_NO_LABELS)
    validate_responce(json, WORKLOAD_NO_LABELS)

def test_workload_requests_per_second(kiali_client):
    json = get_graph_json(client = kiali_client, params = WORKLOAD_REQUESTS_PER_SECOND)
    validate_responce(json, WORKLOAD_REQUESTS_PER_SECOND)

def test_workload_requests_percentage(kiali_client):
    json = get_graph_json(client = kiali_client, params = WORKLOAD_REQUESTS_PERCENTAGE)
    validate_responce(json, WORKLOAD_REQUESTS_PERCENTAGE)

def test_workload_requests_responce_time(kiali_client):
    json = get_graph_json(client = kiali_client, params = WORKLOAD_REQUESTS_RESPONCE_TIME)
    validate_responce(json, WORKLOAD_REQUESTS_RESPONCE_TIME)

def test_workload_app_box_by(kiali_client):
    validate_box_by(kiali_client, params = WORKLOAD_BASE)


def test_box_by_negative(kiali_client):
    params = APP_BASE
    params['boxBy'] = 'junk'
    response = get_response(kiali_client, params)
    assert response.status_code == 400
    assert 'Invalid boxBy' in response.text

def test_graph_type_negative(kiali_client):
    params = APP_BASE
    params['graphType'] = 'junk'
    response = get_response(kiali_client, params)
    assert response.status_code == 400
    assert 'Invalid graphType' in response.text

def test_display_idle_edges(kiali_client):
    json = get_graph_json(client = kiali_client, params = IDLE_EDGES)
    validate_responce(json, IDLE_EDGES)

def test_display_idle_nodes(kiali_client):
    json = get_graph_json(client = kiali_client, params = IDLE_NODES)
    validate_responce(json, IDLE_NODES)

def test_display_operation_nodes(kiali_client):
    json = get_graph_json(client = kiali_client, params = OPERATION_NODES)
    validate_responce(json, OPERATION_NODES)

def test_display_operation_nodes(kiali_client):
    json = get_graph_json(client = kiali_client, params = SERVICE_NODES)
    validate_responce(json, SERVICE_NODES)

def test_display_operation_nodes(kiali_client):
    json = get_graph_json(client = kiali_client, params = REFRESH_RATE)
    validate_responce(json, REFRESH_RATE)

def test_app_inject_service_nodes(kiali_client):
    json = get_graph_json(client = kiali_client, params = APP_INJECT_SERVICE_NODES_TRUE)
    validate_responce(json, APP_INJECT_SERVICE_NODES_TRUE)

    json = get_graph_json(client = kiali_client, params = APP_INJECT_SERVICE_NODES_FALSE)
    validate_responce(json, APP_INJECT_SERVICE_NODES_FALSE)

def test_service_inject_service_nodes(kiali_client):
    json = get_graph_json(client = kiali_client, params = SERVICE_INJECT_SERVICE_NODES_TRUE)
    validate_responce(json, SERVICE_INJECT_SERVICE_NODES_TRUE)

    json = get_graph_json(client = kiali_client, params = SERVICE_INJECT_SERVICE_NODES_TRUE)
    validate_responce(json, SERVICE_INJECT_SERVICE_NODES_TRUE)

def test_versioned_inject_service_nodes(kiali_client):
    json = get_graph_json(client = kiali_client, params = VERSIONED_INJECT_SERVICE_NODES_TRUE)
    validate_responce(json, VERSIONED_INJECT_SERVICE_NODES_TRUE)

    json = get_graph_json(client = kiali_client, params = VERSIONED_INJECT_SERVICE_NODES_FALSE)
    validate_responce(json, VERSIONED_INJECT_SERVICE_NODES_FALSE)

def test_app_appenders_blank(kiali_client):
    json = get_graph_json(client = kiali_client, params = APP_APPENDERS_BLANK)
    validate_responce(json, APP_APPENDERS_BLANK)

def test_app_appenders_invalid_negative(kiali_client):
    params = APP_APPENDERS_INVALID
    response = get_response(kiali_client, params)
    assert response.status_code == 400
    assert 'Invalid appender' in response.text

def test_service_appenders_blank(kiali_client):
    json = get_graph_json(client = kiali_client, params = SERVICE_APPENDERS_BLANK)
    validate_responce(json, SERVICE_APPENDERS_BLANK)

def test_versioned_appenders_blank(kiali_client):
    json = get_graph_json(client = kiali_client, params = VERSIONED_APPENDERS_BLANK)
    validate_responce(json, VERSIONED_APPENDERS_BLANK)

def test_workload_appenders_blank(kiali_client):
    json = get_graph_json(client = kiali_client, params = WORKLOAD_APPENDERS_BLANK)
    validate_responce(json, WORKLOAD_APPENDERS_BLANK)

##

def get_response(client, params):
    params['namespaces'] = conftest.get_bookinfo_namespace()
    return client.request(method_name='graphNamespaces', params=params)

def get_graph_json(client, params):
    response = get_response(client, params)
    assert response.status_code == 200

    return response.json()

def validate_responce(json, params):
    for key, value in params.items():
        if key == 'duration' or key == 'rate':
            assert str(json.get(key)) in str(re.sub("[^0-9]", "", value))
        elif key != 'refresh':
            assert json.get(key) == json.get(key)

    assert len(json.get('elements').get('nodes')) > 0
    assert len(json.get('elements').get('edges')) > 0

def validate_box_by(kiali_client, params):
    for value in BOX_BY_LIST:
        # print("Validating \"boxBy:{}\"".format(value))
        params['boxBy'] = value
        json = get_graph_json(client=kiali_client, params=params)
        validate_responce(json, params)
