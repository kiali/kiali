import pytest
import json
import tests.conftest as conftest
from utils.url_connection import url_connection

# Note: Number of services +1 Views Group Node
# Note: Node and Edge counts are based on traffic origainating from the Ingress
BOOKINFO_EXPECTED_NODES=7
BOOKINFO_EXPECTED_EDGES=6
BOOKINFO_EXPECTED_SERVICES = 4
SERVICE_TO_VALIDATE = 'reviews'
APPLICATION_TO_VALIDATE = 'productpage'

PARAMS = {'graphType': 'versionedApp', 'duration': '60s'}

def test_service_graph_rest_endpoint(kiali_json):

    assert kiali_json != None, "Json: {}".format(kiali_json)

    # Validate that there are Nodes
    assert len(kiali_json.get('elements').get('nodes')) >= 1

    # Validate that there are Edges
    assert len(kiali_json.get('elements').get('edges')) >= 1

def test_service_graph_bookinfo_namespace_(kiali_client):
    bookinfo_namespace = get_bookinfo_namespace()

    # Validate Node count
    nodes = kiali_client.graph_namespace(namespace=bookinfo_namespace, params=PARAMS)["elements"]['nodes']
    #print ("Node count: {}".format(len(nodes)))
    assert len(nodes) >=  BOOKINFO_EXPECTED_NODES
    
    # validate edge count
    edges = kiali_client.graph_namespace(namespace=bookinfo_namespace, params=PARAMS)["elements"]['edges']
    #print ("Edge count: {}".format(len(edges)))
    assert len(edges) >= BOOKINFO_EXPECTED_EDGES

def test_service_list_endpoint(kiali_client):
    bookinfo_namespace = get_bookinfo_namespace()

    assert kiali_client.service_list(namespace=bookinfo_namespace).get('namespace').get('name') == bookinfo_namespace
    assert (len (kiali_client.service_list(namespace=bookinfo_namespace).get('services')) == BOOKINFO_EXPECTED_SERVICES), "Unexpected number of services"

def test_service_detail_endpoint(kiali_client):
    bookinfo_namespace = get_bookinfo_namespace()

    for service in kiali_client.service_list(namespace=bookinfo_namespace).get('services'):
        service_details = kiali_client.service_details(namespace=bookinfo_namespace, service=service.get('name'))
        assert service_details != None
        #assert service_details.get('istioSidecar') == True
        assert 'workloads' in service_details
        assert 'service' in service_details

def test_service_metrics_endpoint(kiali_client):
    bookinfo_namespace = get_bookinfo_namespace()

    service_metrics = kiali_client.service_metrics(namespace=bookinfo_namespace, service=SERVICE_TO_VALIDATE).get('dest')
    assert 'metrics' in service_metrics

def test_service_health_endpoint(kiali_client):
    bookinfo_namespace = get_bookinfo_namespace()

    service_health = kiali_client.service_health(namespace=bookinfo_namespace, service=SERVICE_TO_VALIDATE)
    assert service_health != None
    envoy = service_health.get('envoy')
    assert envoy != None
    assert 'inbound' in envoy
    assert 'outbound' in envoy

def test_service_validations_endpoint(kiali_client):
    bookinfo_namespace = get_bookinfo_namespace()

    assert kiali_client.service_validations(namespace=bookinfo_namespace, service=SERVICE_TO_VALIDATE) != None
    assert len(kiali_client.service_validations(namespace=bookinfo_namespace, service=SERVICE_TO_VALIDATE).get('pod')) > 0

def test_workload_list_endpoint(kiali_client):
    bookinfo_namespace = get_bookinfo_namespace()

    workload_list = kiali_client.workload_list(namespace=bookinfo_namespace)
    assert workload_list != None
    for workload in workload_list.get('workloads'):
        assert workload.get('istioSidecar') == True

def test_application_list_endpoint(kiali_client):
    bookinfo_namespace = get_bookinfo_namespace()

    app_list = kiali_client.app_list(namespace=bookinfo_namespace)
    assert app_list != None
    for app in app_list.get('applications'):
        assert app.get('istioSidecar') == True

    assert app_list.get('namespace').get('name') == bookinfo_namespace

def test_application_details_endpoint(kiali_client):
    bookinfo_namespace = get_bookinfo_namespace()

    app_details = kiali_client.app_details(namespace=bookinfo_namespace, app=APPLICATION_TO_VALIDATE)

    assert app_details != None
    assert app_details.get('namespace').get('name') == bookinfo_namespace
    assert 'workloads' in app_details and (len(app_details.get('workloads')) > 0)
    assert app_details.get('workloads')[0].get('istioSidecar') == True


def test_grafana_url_endpoint(kiali_client):
    url = kiali_client.grafana().get('url')
    assert url != None and 'grafana-istio-system' in url
    #content =  url_connection.open_url_connection(url)
    #assert content != None

def test_jaeger_url_endpoint(kiali_client):
    url = kiali_client.jaeger().get('url')
    assert url != None and 'jaeger-query-istio-system' in url
    #content =  url_connection.open_url_connection(url)
    #assert content != None



####

def get_bookinfo_namespace():
    return conftest.__get_environment_config__(conftest.ENV_FILE).get('mesh_bookinfo_namespace')
