import pytest
import tests.conftest as conftest

bookinfo_namespace = conftest.get_bookinfo_namespace()


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


#############

def get_response(kiali_client, method_name=None, path=None, params=None, data=None, status_code_expected=200, http_method='GET'):
    response = kiali_client.request(method_name=method_name, path=path, params=params, data=data, http_method=http_method)
    assert response is not None
    try:
        assert response.status_code == status_code_expected
    except AssertionError:
        pytest.fail(response.content)
    return response
