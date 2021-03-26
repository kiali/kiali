import pytest
import tests.conftest as conftest

bookinfo_namespace = conftest.get_bookinfo_namespace()

INVALID_PARAMS_NAMESPACE_HEALTH = {'namespace':'invalid'}


def test_workload_health_deployment(kiali_client):
    workload_type = 'Deployment'
    workload_name = 'details-v1'
    response = get_response(kiali_client, method_name='workloadHealth', path={'namespace':bookinfo_namespace, 'workload':workload_name}, params={'type':workload_type, 'rateInterval':'60s'})

    assert response.json().get('workloadStatus') is not None
    assert workload_name == response.json().get('workloadStatus').get('name')

def test_workload_health_replicaset(kiali_client):
    workload_type = 'ReplicaSet'
    workload_name = 'kiali-traffic-generator'
    response = get_response(kiali_client, method_name='workloadHealth', path={'namespace':bookinfo_namespace, 'workload':workload_name}, params={'type':workload_type, 'rateInterval':'60s'})

    assert response.json().get('workloadStatus') is not None
    assert workload_name == response.json().get('workloadStatus').get('name')

def test_service_health_deployment(kiali_client):
    service_name = 'ratings'
    response = get_response(kiali_client, method_name='serviceHealth', path={'namespace':bookinfo_namespace, 'service':service_name}, params={'rateInterval':'60s'})

    assert response.json().get('requests') is not None

def test_namespace_health_workload(kiali_client):
    type_ = 'workload'
    response = get_response(kiali_client, method_name='namespaceHealth', path={'namespace':bookinfo_namespace}, params={'type':type_, 'rateInterval':'60s'})

    assert response.json().get('ratings-v1') is not None

def test_namespace_health_service(kiali_client):
    type_ = 'service'
    response = get_response(kiali_client, method_name='namespaceHealth', path={'namespace':bookinfo_namespace}, params={'type':type_, 'rateInterval':'60s'})

    assert response.json().get('details') is not None

def test_namespace_health_app(kiali_client):
    type_ = 'app'
    response = get_response(kiali_client, method_name='namespaceHealth', path={'namespace':bookinfo_namespace}, params={'type':type_, 'rateInterval':'60s'})

    assert response.json().get('details') is not None

def test_namespace_health_app_invalid_namespace_negative(kiali_client):

    response = get_response(kiali_client, method_name='namespaceHealth', path=INVALID_PARAMS_NAMESPACE_HEALTH, params={'type':'app','rateInterval':'60s'},status_code_expected=403)

def test_namespace_health_service_invalid_namespace_negative(kiali_client):

    response = get_response(kiali_client, method_name='namespaceHealth', path=INVALID_PARAMS_NAMESPACE_HEALTH, params={'type':'service','rateInterval':'60s'},status_code_expected=403)

def test_namespace_health_workload_invalid_namespace_negative(kiali_client):

    response = get_response(kiali_client, method_name='namespaceHealth', path=INVALID_PARAMS_NAMESPACE_HEALTH, params={'type':'workload','rateInterval':'60s'},status_code_expected=403)

def test_namespace_health_app_invalid_namespace_invalid_rateinterval_negative(kiali_client):

    INVALID_APP_QUERY_PARAMS_NAMESPACE_HEALTH = {'type':'app','rateInterval':'invalid'}

    response = get_response(kiali_client, method_name='namespaceHealth', path=INVALID_PARAMS_NAMESPACE_HEALTH, params=INVALID_APP_QUERY_PARAMS_NAMESPACE_HEALTH,status_code_expected=403)

def test_namespace_health_service_invalid_namespace_invalid_rateinterval_negative(kiali_client):

    INVALID_SERVICE_QUERY_PARAMS_NAMESPACE_HEALTH = {'type':'service','rateInterval':'invalid'}

    response = get_response(kiali_client, method_name='namespaceHealth', path=INVALID_PARAMS_NAMESPACE_HEALTH, params=INVALID_SERVICE_QUERY_PARAMS_NAMESPACE_HEALTH,status_code_expected=403)

def test_namespace_health_workload_invalid_namespace_invalid_rateinterval_negative(kiali_client):

    INVALID_WORKLOAD_QUERY_PARAMS_NAMESPACE_HEALTH = {'type':'workload','rateInterval':'invalid'}

    response = get_response(kiali_client, method_name='namespaceHealth', path=INVALID_PARAMS_NAMESPACE_HEALTH, params=INVALID_WORKLOAD_QUERY_PARAMS_NAMESPACE_HEALTH,status_code_expected=403)

def test_namespace_health_invalid_type_negative(kiali_client):

    INVALID_RATEINTERVALQUERY_PARAMS_NAMESPACE_HEALTH = {'type':'invalid','rateInterval':'60s'}

    response = get_response(kiali_client, method_name='namespaceHealth', path={'namespace':bookinfo_namespace}, params=INVALID_RATEINTERVALQUERY_PARAMS_NAMESPACE_HEALTH,status_code_expected=400)

def test_namespace_health_invalid_type_invalid_rateinterval_negative(kiali_client):

    INVALID_TYPE_QUERY_PARAMS_NAMESPACE_HEALTH = {'type':'invalid','rateInterval':'invalid'}

    response = get_response(kiali_client, method_name='namespaceHealth', path={'namespace':bookinfo_namespace}, params=INVALID_TYPE_QUERY_PARAMS_NAMESPACE_HEALTH,status_code_expected=400)

def test_namespace_health_invalid_negative(kiali_client):

    INVALID_QUERY_PARAMS_NAMESPACE_HEALTH = {'type':'invalid','rateInterval':'invalid'}

    response = get_response(kiali_client, method_name='namespaceHealth', path=INVALID_PARAMS_NAMESPACE_HEALTH, params=INVALID_QUERY_PARAMS_NAMESPACE_HEALTH,status_code_expected=400)

def test_namespace_health_invalid_namespace_invalid_type_negative(kiali_client):

    INVALID_TYPE_QUERY_PARAMS_NAMESPACE_HEALTH = {'type':'invalid','rateInterval':'60s'}

    response = get_response(kiali_client, method_name='namespaceHealth', path=INVALID_PARAMS_NAMESPACE_HEALTH, params=INVALID_TYPE_QUERY_PARAMS_NAMESPACE_HEALTH,status_code_expected=400)

def test_namespace_health_app_invalid_rateinterval_negative(kiali_client):

    INVALID_APP_QUERY_PARAMS_NAMESPACE_HEALTH = {'type':'app','rateInterval':'invalid'}

    response = get_response(kiali_client, method_name='namespaceHealth', path={'namespace':bookinfo_namespace}, params=INVALID_APP_QUERY_PARAMS_NAMESPACE_HEALTH,status_code_expected=500)

def test_namespace_health_service_invalid_rateinterval_negative(kiali_client):

    INVALID_SERVICE_QUERY_PARAMS_NAMESPACE_HEALTH = {'type':'service','rateInterval':'invalid'}

    response = get_response(kiali_client, method_name='namespaceHealth', path={'namespace':bookinfo_namespace}, params=INVALID_SERVICE_QUERY_PARAMS_NAMESPACE_HEALTH,status_code_expected=500)

def test_namespace_health_workload_invalid_rateinterval_negative(kiali_client):

    INVALID_WORKLOAD_QUERY_PARAMS_NAMESPACE_HEALTH = {'type':'workload','rateInterval':'invalid'}

    response = get_response(kiali_client, method_name='namespaceHealth', path={'namespace':bookinfo_namespace}, params=INVALID_WORKLOAD_QUERY_PARAMS_NAMESPACE_HEALTH,status_code_expected=500)


def test_workload_health_invalid_replicaset_negative(kiali_client):
    workload_type = 'ReplicaSet'
    workload_name = 'details-v1'
    response = get_response(kiali_client, method_name='workloadHealth', path={'namespace':bookinfo_namespace, 'workload':workload_name}, params={'type':workload_type, 'rateInterval':'60s'},status_code_expected=502)


#############

def get_response(kiali_client, method_name=None, path=None, params=None, data=None, status_code_expected=200, http_method='GET'):
    response = kiali_client.request(method_name=method_name, path=path, params=params, data=data, http_method=http_method)
    assert response is not None
    try:
        assert response.status_code == status_code_expected
    except AssertionError:
        pytest.fail(response.content)
    return response
