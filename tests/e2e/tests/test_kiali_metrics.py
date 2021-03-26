import pytest
import tests.conftest as conftest

bookinfo_namespace = conftest.get_bookinfo_namespace()


def test_namespace_metrics(kiali_client):
    PARAMS={'filters':'tcp_sent,tcp_received'}
    response = get_response(kiali_client, method_name='namespaceMetrics', path={'namespace':bookinfo_namespace}, params=PARAMS)

    validate_response_content(response, PARAMS)

def test_services_metrics(kiali_client):
    PARAMS={'filters':'request_count,request_duration_millis,request_error_count'}
    response = get_response(kiali_client, method_name='serviceMetrics', path={'namespace':bookinfo_namespace, 'service':'ratings'}, params=PARAMS)

    validate_response_content(response, PARAMS)

def test_services_metrics_invalid_filter_negative(kiali_client):
    filter_name = 'invalid'
    PARAMS={'filters':filter_name}
    response = get_response(kiali_client, method_name='namespaceMetrics', path={'namespace':bookinfo_namespace}, params=PARAMS)

    assert filter_name not in response.json().get('tcp_received')

#############

def get_response(kiali_client, method_name=None, path=None, params=None, data=None, status_code_expected=200, http_method='GET'):
    response = kiali_client.request(method_name=method_name, path=path, params=params, data=data, http_method=http_method)
    assert response is not None
    try:
        assert response.status_code == status_code_expected
    except AssertionError:
        pytest.fail(response.content)
    return response

def validate_response_content(response, params):
    filters = params.get('filters').split(',')
    for i in range(len(filters)):
        filter_name = filters[i]
        assert filter_name in response.json()
        assert response.json().get(filter_name) is not None
        filter_list = response.json().get(filter_name)
        assert len(filter_list) != 0
        assert len(filter_list[0]['datapoints']) != 0
