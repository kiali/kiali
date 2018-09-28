import pytest
import tests.conftest as conftest
from utils.command_exec import command_exec
from utils.timeout import timeout
import time

BOOKINFO_EXPECTED_SERVICES = 4
BOOKINFO_EXPECTED_SERVICES_MONGODB = 5
SERVICE_TO_VALIDATE = 'reviews'
VIRTUAL_SERVICE_FILE = 'assets/bookinfo-reviews-80-20.yaml'
DESTINATION_RULE_FILE = 'assets/bookinfo-destination-rule-reviews.yaml'

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

def test_service_detail_with_virtual_service(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_endpoint()

    try:
      # Add a virtual service that will be tested
      assert command_exec.oc_apply(VIRTUAL_SERVICE_FILE, bookinfo_namespace) == True

      with timeout(seconds=10, error_message='Timed out waiting for virtual service creation'):
        while True:
          service_details = kiali_client.service_details(namespace=bookinfo_namespace, service=SERVICE_TO_VALIDATE)
          if service_details != None and service_details.get('virtualServices') != None and len(service_details.get('virtualServices')) > 0:
            break

          time.sleep(1)

      assert service_details != None

      virtual_service = service_details.get('virtualServices')[0]
      assert virtual_service != None
      assert virtual_service.get('name') == 'reviews'

      https = virtual_service.get('http')
      assert https != None
      assert len (https) == 1

      routes = https[0].get('route')
      assert len (routes) == 2

      assert routes[0].get('weight') == 80
      destination = routes[0].get('destination')
      assert destination != None
      assert destination.get('host') == 'reviews'
      assert destination.get('subset') == 'v1'

      assert routes[1].get('weight') == 20
      destination = routes[1].get('destination')
      assert destination != None
      assert destination.get('host') == 'reviews'
      assert destination.get('subset') == 'v2'

    finally:
      assert command_exec.oc_delete(VIRTUAL_SERVICE_FILE, bookinfo_namespace) == True

      with timeout(seconds=10, error_message='Timed out waiting for virtual service deletion'):
        while True:
          service_details = kiali_client.service_details(namespace=bookinfo_namespace, service=SERVICE_TO_VALIDATE)
          if service_details != None and service_details.get('virtualServices') == None:
            break

          time.sleep(1)

def test_service_detail_with_destination_rule(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_endpoint()

    try:
      # Add a destination rule that will be tested
      assert command_exec.oc_apply(DESTINATION_RULE_FILE, bookinfo_namespace) == True

      with timeout(seconds=10, error_message='Timed out waiting for destination rule creation'):
        while True:
          service_details = kiali_client.service_details(namespace=bookinfo_namespace, service=SERVICE_TO_VALIDATE)
          if service_details != None and service_details.get('destinationRules') != None and len(service_details.get('destinationRules')) > 0:
            break

          time.sleep(1)

      assert service_details != None

      destination_rule = service_details.get('destinationRules')[0]
      assert destination_rule != None
      assert destination_rule.get('name') == 'reviews'
      assert 'trafficPolicy' in destination_rule

      subsets = destination_rule.get('subsets')
      assert subsets != None
      assert len (subsets) == 3

      for i, subset in enumerate(subsets):
        subset_number = str(i + 1)

        name = subset.get('name')
        assert name == 'v' + subset_number

        labels = subset.get('labels')
        assert labels != None and labels.get('version') == 'v' + subset_number

    finally:
      assert command_exec.oc_delete(DESTINATION_RULE_FILE, bookinfo_namespace) == True

      with timeout(seconds=10, error_message='Timed out waiting for destination rule deletion'):
        while True:
          service_details = kiali_client.service_details(namespace=bookinfo_namespace, service=SERVICE_TO_VALIDATE)
          if service_details != None and service_details.get('destinationRules') == None:
            break

          time.sleep(1)

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
