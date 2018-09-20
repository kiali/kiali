import pytest
import tests.conftest as conftest

BOOKINFO_EXPECTED_SERVICES = 4
BOOKINFO_EXPECTED_SERVICES_MONGODB = 5
SERVICE_TO_VALIDATE = 'reviews'

def test_service_list_endpoint(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_endpoint()

    service_list_json = kiali_client.service_list(namespace=bookinfo_namespace)
    assert service_list_json.get('namespace').get('name') == bookinfo_namespace

    services = service_list_json.get('services')
    assert (len (services) == BOOKINFO_EXPECTED_SERVICES) or (len (services) == BOOKINFO_EXPECTED_SERVICES_MONGODB)

    for service in services:
      assert service != None
      assert service.get('name') != None and service.get('name') != ''
      assert service.get('istioSidecar') == True
      assert service.get('appLabel') == True

def test_service_detail_endpoint(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_endpoint()

    service_details = kiali_client.service_details(namespace=bookinfo_namespace, service=SERVICE_TO_VALIDATE)
    assert service_details != None
    assert service_details.get('istioSidecar') == True
    assert 'ports' in service_details.get('service')
    assert 'labels' in service_details.get('service')
    assert 'workloads' in service_details
    assert 'service' in service_details
    assert 'endpoints' in service_details
    assert 'virtualServices' in service_details
    assert 'destinationRules' in service_details
    assert 'health' in service_details

def test_service_metrics_endpoint(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_endpoint()

    service = kiali_client.service_metrics(namespace=bookinfo_namespace, service=SERVICE_TO_VALIDATE)
    for direction in ['dest', 'source']:
      assert service != None

      metrics = service.get(direction).get('metrics')
      assert 'request_count_in' in metrics
      assert 'request_error_count_in' in metrics
      assert 'tcp_received_in' in metrics
      assert 'tcp_sent_in' in metrics

      histograms = service.get(direction).get('histograms')
      assert 'request_duration_in' in histograms
      assert 'request_size_in' in histograms
      assert 'response_size_in' in histograms

def test_service_health_endpoint(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_endpoint()

    service_health = kiali_client.service_health(namespace=bookinfo_namespace, service=SERVICE_TO_VALIDATE)
    assert service_health != None

    envoy = service_health.get('envoy')
    assert envoy != None
    assert 'inbound' in envoy
    assert 'outbound' in envoy

    assert 'requests' in service_health

def test_service_validations_endpoint(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_endpoint()

    service_validations = kiali_client.service_validations(namespace=bookinfo_namespace, service=SERVICE_TO_VALIDATE)
    assert service_validations != None
    assert len(service_validations.get('pod')) > 0
