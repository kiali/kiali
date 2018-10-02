import pytest
import tests.conftest as conftest

WORKLOAD_TO_VALIDATE = 'details-v1'
WORKLOAD_TYPE = 'Deployment'

def test_workload_list_endpoint(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_namespace()

    workload_list = kiali_client.workload_list(namespace=bookinfo_namespace)
    assert workload_list != None
    for workload in workload_list.get('workloads'):
      assert workload != None
      assert workload.get('name') != None and workload.get('name') != ''
      assert workload.get('istioSidecar') == True
      assert workload.get('appLabel') == True
      assert workload.get('versionLabel') == True

def test_workload_details(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_namespace()

    workload = kiali_client.workload_details(namespace=bookinfo_namespace, workload=WORKLOAD_TO_VALIDATE)
    assert workload != None
    assert WORKLOAD_TO_VALIDATE in workload.get('name')
    assert WORKLOAD_TYPE in workload.get('type')
    assert 'labels' in workload
    assert 'templateAnnotations' in workload
    assert 'pods' in workload
    assert 'services' in workload

def test_workload_metrics(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_namespace()

    workload = kiali_client.workload_metrics(namespace=bookinfo_namespace, workload=WORKLOAD_TO_VALIDATE)
    for direction in ['dest', 'source']:
      assert workload != None

      metrics = workload.get(direction).get('metrics')
      assert 'request_count_in' in metrics
      assert 'request_count_out' in metrics
      assert 'request_error_count_in' in metrics
      assert 'request_error_count_out' in metrics
      assert 'tcp_received_in' in metrics
      assert 'tcp_received_out' in metrics
      assert 'tcp_sent_in' in metrics
      assert 'tcp_sent_out' in metrics

      histograms = workload.get(direction).get('histograms')
      assert 'request_duration_in' in histograms
      assert 'request_duration_out' in histograms
      assert 'request_size_in' in histograms
      assert 'request_size_out' in histograms
      assert 'response_size_in' in histograms
      assert 'response_size_out' in histograms

def test_workload_health(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_namespace()

    workload = kiali_client.workload_health(namespace=bookinfo_namespace, workload=WORKLOAD_TO_VALIDATE)
    assert workload != None
    assert WORKLOAD_TO_VALIDATE in workload.get('deploymentStatus').get('name')
    assert 'requests' in workload

def test_workload_istio_validations(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_namespace()

    workload = kiali_client.workload_istio_validations(namespace=bookinfo_namespace, workload=WORKLOAD_TO_VALIDATE)
    assert workload != None
    wp = workload.get('pod')
    assert wp != None
    assert WORKLOAD_TO_VALIDATE in wp.get(list(wp.keys())[0]).get('name')
    assert wp.get(list(wp.keys())[0]).get('valid') == True
