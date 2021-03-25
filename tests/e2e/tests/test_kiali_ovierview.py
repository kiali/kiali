import pytest
import tests.conftest as conftest

bookinfo_namespace = conftest.get_bookinfo_namespace()


def test_app_overview_health(kiali_client):
    ovieview_type = 'app'
    response = get_response(kiali_client, method_name='namespaceHealth', path={'namespace':bookinfo_namespace}, params={'type':ovieview_type,'rateInterval':'60s'})
    verify_response(response, ovieview_type=ovieview_type)

def test_service_overview_health(kiali_client):
    ovieview_type = 'service'
    response = get_response(kiali_client, method_name='namespaceHealth', path={'namespace':bookinfo_namespace}, params={'type':ovieview_type,'rateInterval':'60s'})
    verify_response(response, ovieview_type=ovieview_type)

def test_workload_overview_health(kiali_client):
    ovieview_type = 'workload'
    response = get_response(kiali_client, method_name='namespaceHealth', path={'namespace':bookinfo_namespace}, params={'type':ovieview_type,'rateInterval':'60s'})
    verify_response(response, ovieview_type=ovieview_type)

def test_overview_negative_403(kiali_client):
    
    INVALID_PARAMS_NAMESPACEHEALTH = {'namespace':'invalid'}
    INVALID_APP_QUERY_PARAMS_NAMESPACEHEALTH = {'type':'app','rateInterval':'invalid'}
    INVALID_SERVICE_QUERY_PARAMS_NAMESPACEHEALTH = {'type':'service','rateInterval':'invalid'}
    INVALID_WORKLOAD_QUERY_PARAMS_NAMESPACEHEALTH = {'type':'workload','rateInterval':'invalid'}

    response = get_response(kiali_client, method_name='namespaceHealth', path=INVALID_PARAMS_NAMESPACEHEALTH, params={'type':'app','rateInterval':'60s'},status_code_expected=403)
    response = get_response(kiali_client, method_name='namespaceHealth', path=INVALID_PARAMS_NAMESPACEHEALTH, params={'type':'service','rateInterval':'60s'},status_code_expected=403)
    response = get_response(kiali_client, method_name='namespaceHealth', path=INVALID_PARAMS_NAMESPACEHEALTH, params={'type':'workload','rateInterval':'60s'},status_code_expected=403)
    response = get_response(kiali_client, method_name='namespaceHealth', path=INVALID_PARAMS_NAMESPACEHEALTH, params=INVALID_APP_QUERY_PARAMS_NAMESPACEHEALTH,status_code_expected=403)
    response = get_response(kiali_client, method_name='namespaceHealth', path=INVALID_PARAMS_NAMESPACEHEALTH, params=INVALID_SERVICE_QUERY_PARAMS_NAMESPACEHEALTH,status_code_expected=403)
    response = get_response(kiali_client, method_name='namespaceHealth', path=INVALID_PARAMS_NAMESPACEHEALTH, params=INVALID_WORKLOAD_QUERY_PARAMS_NAMESPACEHEALTH,status_code_expected=403)

def test_overview_negative_400(kiali_client):

    INVALID_PARAMS_NAMESPACEHEALTH = {'namespace':'invalid'}
    INVALID_QUERY_PARAMS_NAMESPACEHEALTH = {'type':'invalid','rateInterval':'60s'}
    INVALID_TYPE_QUERY_PARAMS_NAMESPACEHEALTH = {'type':'invalid','rateInterval':'invalid'}

    response = get_response(kiali_client, method_name='namespaceHealth', path={'namespace':bookinfo_namespace}, params=INVALID_QUERY_PARAMS_NAMESPACEHEALTH,status_code_expected=400)
    response = get_response(kiali_client, method_name='namespaceHealth', path=INVALID_PARAMS_NAMESPACEHEALTH, params=INVALID_QUERY_PARAMS_NAMESPACEHEALTH,status_code_expected=400)
    response = get_response(kiali_client, method_name='namespaceHealth', path={'namespace':bookinfo_namespace}, params=INVALID_TYPE_QUERY_PARAMS_NAMESPACEHEALTH,status_code_expected=400)
    response = get_response(kiali_client, method_name='namespaceHealth', path=INVALID_PARAMS_NAMESPACEHEALTH, params=INVALID_TYPE_QUERY_PARAMS_NAMESPACEHEALTH,status_code_expected=400)

def test_overview_negative_500(kiali_client):

    INVALID_APP_QUERY_PARAMS_NAMESPACEHEALTH = {'type':'app','rateInterval':'invalid'}
    INVALID_SERVICE_QUERY_PARAMS_NAMESPACEHEALTH = {'type':'service','rateInterval':'invalid'}
    INVALID_WORKLOAD_QUERY_PARAMS_NAMESPACEHEALTH = {'type':'workload','rateInterval':'invalid'}

    response = get_response(kiali_client, method_name='namespaceHealth', path={'namespace':bookinfo_namespace}, params=INVALID_APP_QUERY_PARAMS_NAMESPACEHEALTH,status_code_expected=500)
    response = get_response(kiali_client, method_name='namespaceHealth', path={'namespace':bookinfo_namespace}, params=INVALID_SERVICE_QUERY_PARAMS_NAMESPACEHEALTH,status_code_expected=500)
    response = get_response(kiali_client, method_name='namespaceHealth', path={'namespace':bookinfo_namespace}, params=INVALID_WORKLOAD_QUERY_PARAMS_NAMESPACEHEALTH,status_code_expected=500)


##########


def get_response(kiali_client, method_name=None, path=None, params=None, data=None, status_code_expected=200, http_method='GET'):
    response = kiali_client.request(method_name=method_name, path=path, params=params, data=data, http_method=http_method)
    assert response is not None
    try:
        assert response.status_code == status_code_expected
    except AssertionError:
        pytest.fail(response.content)
    return response


def verify_response(response = None, ovieview_type=None):
    assert response.status_code == 200
    details = response.json().get('details')
    assert details != ''