import pytest
import tests.conftest as conftest

BOOKINFO_EXPECTED_SERVICES = 4
BOOKINFO_EXPECTED_SERVICES_MONGODB = 5
SERVICE_TO_VALIDATE = 'reviews'

def test_service_list_endpoint(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_endpoint()

    assert kiali_client.service_list(namespace=bookinfo_namespace).get('namespace').get('name') == bookinfo_namespace
    number_services = len (kiali_client.service_list(namespace=bookinfo_namespace).get('services'))
    assert (number_services == BOOKINFO_EXPECTED_SERVICES) or (number_services == BOOKINFO_EXPECTED_SERVICES_MONGODB)

def test_service_detail_endpoint(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_endpoint()

    service_details = kiali_client.service_details(namespace=bookinfo_namespace, service=SERVICE_TO_VALIDATE)
    assert service_details != None
    assert service_details.get('istioSidecar') == True
    assert 'workloads' in service_details
    assert 'service' in service_details

def test_service_metrics_endpoint(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_endpoint()

    service_metrics = kiali_client.service_metrics(namespace=bookinfo_namespace, service=SERVICE_TO_VALIDATE).get('dest')
    assert 'metrics' in service_metrics

def test_service_health_endpoint(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_endpoint()

    service_health = kiali_client.service_health(namespace=bookinfo_namespace, service=SERVICE_TO_VALIDATE)
    assert service_health != None
    envoy = service_health.get('envoy')
    assert envoy != None
    assert 'inbound' in envoy
    assert 'outbound' in envoy

def test_service_validations_endpoint(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_endpoint()

    service_validations = kiali_client.service_validations(namespace=bookinfo_namespace, service=SERVICE_TO_VALIDATE)
    assert service_validations != None
    assert len(service_validations.get('pod')) > 0

