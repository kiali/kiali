import pytest
import tests.conftest as conftest
from utils.url_connection import url_connection

VALIDATE_GRAFANA_URL_CONNECTION = False
VALIDATE_JAEGER_URL_CONNECTION = False

def test_grafana_url_endpoint(kiali_client):
    url = kiali_client.request(method_name='grafanaInfo').json().get('url')
    assert url != None and 'grafana-istio-system' in url
    if VALIDATE_GRAFANA_URL_CONNECTION:
        content =  url_connection.open_url_connection(url)
        assert content != None
    else:
        print("Skipping Grafana URL Connection Validation")

def __test_jaeger_url_endpoint(kiali_client):
    url = kiali_client.request(method_name='jaegerInfo').json().get('url')
    assert url != None and 'jaeger-query-istio-system' in url

    if VALIDATE_JAEGER_URL_CONNECTION:
        content =  url_connection.open_url_connection(url)
        assert content != None
    else:
        print ("Skipping Jaeger URL Connection Validation")
