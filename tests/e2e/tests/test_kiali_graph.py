import tests.conftest as conftest

APP_BASE                   = {'graphType':'app', 'duration':'60s'}
APP_NO_LABELS              = {'graphType':'app', 'edges':'noEdgeLabels', 'duration':'60s'}
APP_REQUESTS_PER_SECOND    = {'graphType':'app', 'edges':'requestsPerSecond', 'duration':'60s'}
APP_REQUESTS_PERCENTAGE    = {'graphType':'app', 'edges':'requestsPercentage', 'duration':'60s'}
APP_REQUESTS_RESPONCE_TIME = {'graphType':'app', 'edges':'responseTime', 'duration':'60s'}

SERVICE_BASE                   = {'graphType':'service', 'duration':'300s'}
SERVICE_NO_LABELS              = {'graphType':'service', 'edges':'noEdgeLabels', 'duration':'300s'}
SERVICE_REQUESTS_PER_SECOND    = {'graphType':'service', 'edges':'requestsPerSecond', 'duration':'300s'}
SERVICE_REQUESTS_PERCENTAGE    = {'graphType':'service', 'edges':'requestsPercentage', 'duration':'300s'}
SERVICE_REQUESTS_RESPONCE_TIME = {'graphType':'service', 'edges':'responseTime', 'duration':'300s'}

VERSIONED_APP_BASE                   = {'graphType':'versionedApp', 'duration':'600s'}
VERSIONED_APP_NO_LABELS              = {'graphType':'versionedApp', 'edges':'noEdgeLabels', 'duration':'600s'}
VERSIONED_APP_REQUESTS_PER_SECOND    = {'graphType':'versionedApp', 'edges':'requestsPerSecond', 'duration':'600s'}
VERSIONED_APP_REQUESTS_PERCENTAGE    = {'graphType':'versionedApp', 'edges':'requestsPercentage', 'duration':'600s'}
VERSIONED_APP_REQUESTS_RESPONCE_TIME = {'graphType':'versionedApp', 'edges':'responseTime', 'duration':'600s'}

WORKLOAD_BASE                   = {'graphType':'workload', 'duration':'21600s'}
WORKLOAD_NO_LABELS              = {'graphType':'workload', 'edges':'noEdgeLabels', 'duration':'21600s'}
WORKLOAD_REQUESTS_PER_SECOND    = {'graphType':'workload', 'edges':'requestsPerSecond', 'duration':'21600s'}
WORKLOAD_REQUESTS_PERCENTAGE    = {'graphType':'workload', 'edges':'requestsPercentage', 'duration':'21600s'}
WORKLOAD_REQUESTS_RESPONCE_TIME = {'graphType':'workload', 'edges':'responseTime', 'duration':'21600s'}

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

def test_app_group_by(kiali_client):
    validate_group_by(kiali_client, params = APP_BASE)

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

def test_service_group_by(kiali_client):
    validate_group_by(kiali_client, params = SERVICE_BASE)

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

def test_versioned_app_group_by(kiali_client):
    validate_group_by(kiali_client, params = VERSIONED_APP_BASE)

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

def test_workload_app_group_by(kiali_client):
    validate_group_by(kiali_client, params = WORKLOAD_BASE)


def test_group_by_negative(kiali_client):
    params = APP_BASE
    params['boxBy'] = 'junk'
    response = get_response(kiali_client, params)
    assert response.status_code == 400
    assert 'Invalid groupBy' in response.text

def test_graph_type_negative(kiali_client):
    params = APP_BASE
    params['graphType'] = 'junk'
    response = get_response(kiali_client, params)
    assert response.status_code == 400
    assert 'Invalid graphType' in response.text

##

def get_response(client, params):
    params['namespaces'] = conftest.get_bookinfo_namespace()
    return client.request(method_name='graphNamespaces', params=params)

def get_graph_json(client, params):
    response = get_response(client, params)
    assert response.status_code == 200

    return response.json()

def validate_responce(json, params):
    assert str(json.get('duration')) in params['duration']
    assert json.get('graphType') == params['graphType']

    assert len(json.get('elements').get('nodes')) > 0
    assert len(json.get('elements').get('edges')) > 0

def validate_group_by(kiali_client, params):
    for value in GROUP_BY_LIST:
        # print("Validating \"groupBy:{}\"".format(value))
        params['groupBy'] = value
        json = get_graph_json(client=kiali_client, params=params)
        validate_responce(json, params)
