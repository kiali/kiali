import json
import tests.conftest as conftest

APPLICATION_TO_VALIDATE = 'productpage'

PARAMS = {'graphType': 'versionedApp', 'duration': '60s'}

def _test_application_list_endpoint(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_namespace()

    app_list = kiali_client.app_list(namespace=bookinfo_namespace)
    assert app_list != None
    for app in app_list.get('applications'):
      assert app.get('name') != None and app.get('name') != ''
      assert app.get('istioSidecar') == True

    assert app_list.get('namespace').get('name') == bookinfo_namespace

def test_application_details_endpoint(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_namespace()

    app_details = kiali_client.app_details(namespace=bookinfo_namespace, app=APPLICATION_TO_VALIDATE)

    assert app_details != None

    assert 'namespace' in app_details and app_details.get('namespace').get('name') == bookinfo_namespace

    assert 'workloads' in app_details
    workloads = app_details.get('workloads')
    assert len(workloads) > 0

    for workload in workloads:
      assert workload.get('istioSidecar') == True
      assert 'serviceNames' in workload and len (workload.get('serviceNames')) > 0


def test_application_health_endpoint(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_namespace()

    app_health = kiali_client.app_health(namespace=bookinfo_namespace, app=APPLICATION_TO_VALIDATE)
    assert app_health != None

    envoy = app_health.get('envoy')[0]
    assert envoy != None
    assert 'inbound' in envoy
    assert 'outbound' in envoy

    assert 'requests' in app_health
    assert 'workloadStatuses' in app_health

def test_application_metrics_endpoint(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_namespace()

    app_metrics = kiali_client.app_metrics(namespace=bookinfo_namespace, app=APPLICATION_TO_VALIDATE)
    assert app_metrics != None

    for direction in ['dest', 'source']:
      metrics = app_metrics.get(direction).get('metrics')
      assert 'request_count_in' in metrics
      assert 'request_count_out' in metrics
      assert 'request_error_count_in' in metrics
      assert 'request_error_count_out' in metrics
      assert 'tcp_received_in' in metrics
      assert 'tcp_received_out' in metrics
      assert 'tcp_sent_in' in metrics
      assert 'tcp_sent_out' in metrics

      histograms = app_metrics.get(direction).get('histograms')
      assert 'request_duration_in' in histograms
      assert 'request_duration_out' in histograms
      assert 'request_size_in' in histograms
      assert 'request_size_out' in histograms
      assert 'response_size_in' in histograms
      assert 'response_size_out' in histograms
