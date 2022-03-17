import pytest
import tests.conftest as conftest
from utils.command_exec import command_exec
from utils.timeout import timeout
import calendar
import time

gmt = time.gmtime



BOOKINFO_EXPECTED_SERVICES = 4
BOOKINFO_EXPECTED_SERVICES_MONGODB = 5
SERVICE_TO_VALIDATE = 'reviews'
VIRTUAL_SERVICE_FILE = 'assets/bookinfo-reviews-80-20.yaml'
DESTINATION_RULE_FILE = 'assets/bookinfo-destination-rule-reviews.yaml'

METRICS_PARAMS = {"direction": "outbound", "reporter": "destination"}

def test_service_list_endpoint(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_namespace()

    services = get_service_list(kiali_client, bookinfo_namespace)
    assert (len (services) == BOOKINFO_EXPECTED_SERVICES) or (len (services) >= BOOKINFO_EXPECTED_SERVICES_MONGODB)

    for service in services:
      assert service != None
      assert service.get('name') != None and service.get('name') != ''
      assert service.get('istioSidecar') == True
      assert service.get('appLabel') == True

def test_service_detail_endpoint(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_namespace()

    service_details = kiali_client.request(method_name='serviceDetails', path={'namespace': bookinfo_namespace, 'service':SERVICE_TO_VALIDATE}).json()
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
    bookinfo_namespace = conftest.get_bookinfo_namespace()

    try:
      # check if we have any existing virtual services
      pre_vs_count = len(kiali_client.request(
          method_name='serviceDetails',
          path={'namespace': bookinfo_namespace,
                'service': SERVICE_TO_VALIDATE}).json().get('virtualServices'))

      # Add a virtual service that will be tested
      assert command_exec.oc_apply(VIRTUAL_SERVICE_FILE, bookinfo_namespace) == True

      with timeout(seconds=60, error_message='Timed out waiting for virtual service creation'):
        while True:
          service_details = kiali_client.request(method_name='serviceDetails', path={'namespace': bookinfo_namespace, 'service': SERVICE_TO_VALIDATE}).json()
          if service_details != None and service_details.get('virtualServices') != None and len(service_details.get('virtualServices')) > pre_vs_count:
            break

          time.sleep(1)

      assert service_details != None

      virtual_service_descriptor = service_details.get('virtualServices')
      assert virtual_service_descriptor != None

      # find our virtual service
      virtual_service = None
      for vs in virtual_service_descriptor:
          if(vs['metadata']['name'] == 'reviews'):
              virtual_service = vs
              break
      assert virtual_service != None

      virtual_service_meta = virtual_service.get('metadata')
      assert virtual_service_meta.get('name') == 'reviews'

      virtual_service_spec = virtual_service.get('spec')
      https = virtual_service_spec.get('http')
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

      with timeout(seconds=60, error_message='Timed out waiting for virtual service deletion'):
        while True:
          service_details = kiali_client.request(method_name='serviceDetails', path={'namespace': bookinfo_namespace, 'service':SERVICE_TO_VALIDATE}).json()
          if service_details != None and len(service_details.get('virtualServices')) == pre_vs_count:
            break

          time.sleep(1)

def test_service_detail_with_destination_rule(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_namespace()

    try:
      # check if we have any existing rules
      pre_dr_count = len(kiali_client.request(
          method_name='serviceDetails',
          path={'namespace': bookinfo_namespace,
                'service':SERVICE_TO_VALIDATE}).json().get('destinationRules'))

      # Add a destination rule that will be tested
      assert command_exec.oc_apply(DESTINATION_RULE_FILE, bookinfo_namespace) == True

      with timeout(seconds=60, error_message='Timed out waiting for destination rule creation'):
        while True:
          service_details = kiali_client.request(method_name='serviceDetails', path={'namespace': bookinfo_namespace, 'service':SERVICE_TO_VALIDATE}).json()
          if service_details != None and service_details.get('destinationRules') != None and len(service_details.get('destinationRules')) > pre_dr_count:
            break

          time.sleep(1)

      assert service_details != None

      destination_rule_descriptor = service_details.get('destinationRules')
      assert destination_rule_descriptor != None

      # find our destination rule
      destination_rule = None
      for dr in destination_rule_descriptor:
          if(dr['metadata']['name'] == 'reviews'):
              destination_rule = dr
              break
      assert destination_rule != None

      destination_rule_meta = destination_rule.get('metadata')
      assert destination_rule_meta.get('name') == 'reviews'

      destination_rule_spec = destination_rule.get('spec')
      assert 'trafficPolicy' in destination_rule_spec

      subsets = destination_rule_spec.get('subsets')
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

      with timeout(seconds=60, error_message='Timed out waiting for destination rule deletion'):
        while True:
          service_details = kiali_client.request(method_name='serviceDetails', path={'namespace': bookinfo_namespace, 'service':SERVICE_TO_VALIDATE}).json()
          if service_details != None and len(service_details.get('destinationRules')) == pre_dr_count:
            break

          time.sleep(1)

def test_service_metrics_endpoint(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_namespace()

    service = kiali_client.request(method_name='serviceMetrics', path={'namespace': bookinfo_namespace, 'service':SERVICE_TO_VALIDATE}, params=METRICS_PARAMS)
    assert service != None

    metrics = service.json()
    assert 'request_count' in metrics
    assert 'request_error_count' in metrics
    assert 'tcp_received' in metrics
    assert 'tcp_sent' in metrics
    assert 'request_duration_millis' in metrics
    assert 'request_size' in metrics
    assert 'response_size' in metrics

def __test_service_health_endpoint(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_namespace()

    service_health = kiali_client.request(method_name='serviceHealth', path={'namespace': bookinfo_namespace, 'service':SERVICE_TO_VALIDATE}).json()
    assert service_health != None

    assert 'requests' in service_health

    reqs = service_health.get('requests')
    assert reqs != None
    assert 'inbound' in reqs
    assert 'outbound' in reqs

def test_service_validations_endpoint(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_namespace()

    result = kiali_client.request(method_name='serviceDetails', path={'namespace': bookinfo_namespace, 'service':SERVICE_TO_VALIDATE}, params={'validate': 'true', 'gateway': 'true'})

    service_validations = result.json()
    assert service_validations != None
    assert service_validations.get('validations') != None
    gateway = service_validations.get('validations').get('gateway')
    if gateway != None:
        for g in gateway:
            assert gateway.get(g).get('valid')

def test_service_spans(kiali_client):

    if 'v1.0' in get_kiali_version(kiali_client).get('Kiali core version'):
        pytest.skip()

    bookinfo_namespace = conftest.get_bookinfo_namespace()
    services = get_service_list(kiali_client, bookinfo_namespace)
    assert services != None

    for service in services:
        name = service.get('name')
        spansList = kiali_client.request(method_name='appSpans', path={'namespace': bookinfo_namespace, 'service': name}, params={'startMicros': calendar.timegm(gmt())}).json()
        assert spansList != None
        
        for span in spansList:
            assert span.get('traceID') != None
            assert span.get('spanID') != None
            assert span.get('operationName') != None

def test_service_traces_detail(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_namespace()

    if 'v1.0' in get_kiali_version(kiali_client).get('Kiali core version'):
        pytest.skip()

    services = get_service_list(kiali_client, bookinfo_namespace)
    assert services != None

    for service in services:
        name = service.get('name')
        tracesDetailsList = kiali_client.request(method_name='appTraces', path={'namespace': bookinfo_namespace, 'service': name}, params={'startMicros': calendar.timegm(gmt())}).json()
        assert tracesDetailsList != None

        for tracesDetail in tracesDetailsList.get('data'):
            assert tracesDetail.get('traceID') != None
            assert tracesDetail.get('spans') != None


def get_kiali_version(kiali_client):
    try:
        response = kiali_client.request(method_name='getStatus')
        kiali_version = response.json().get('status')
    except AssertionError:
        pytest.fail(response.content)

    return kiali_version

def get_service_list(kiali_client, namespace):
    service_list_json = kiali_client.request(method_name='serviceList', path={'namespace': namespace}).json()
    assert service_list_json.get('namespace').get('name') == namespace

    return service_list_json.get('services')
