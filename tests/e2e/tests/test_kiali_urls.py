import pytest
import tests.conftest as conftest
from utils.url_connection import url_connection

VALIDATE_GRAFANA_URL_CONNECTION = False
VALIDATE_JAEGER_URL_CONNECTION = False

def test_grafana_url_endpoint(kiali_client):
    response = kiali_client.request(method_name='grafanaInfo')
    url = kiali_client.request(method_name='grafanaInfo').json()
    assert url != None
    if VALIDATE_GRAFANA_URL_CONNECTION:
        content =  url_connection.open_url_connection(url)
        assert content != None
    else:
        print("Skipping Grafana URL Connection Validation")

def test_jaeger_url_endpoint(kiali_client):
    response = kiali_client.request(method_name='jaegerInfo')
    if response.status_code == 200:
        url = response.json().get('url')
        assert url != None and ('jaeger' in url or 'tracing' in url)
    elif response.status_code == 503:
        pytest.skip()
