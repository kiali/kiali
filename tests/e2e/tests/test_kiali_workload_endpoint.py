import pytest
import tests.conftest as conftest
import time
from utils.command_exec import command_exec
from utils.timeout import timeout

WORKLOAD_TO_VALIDATE = 'details-v1'
WORKLOAD_TYPE = 'Deployment'
BOOKINFO_WORKLOADS_COUNT = 6
EXTRA_WORKLOAD_COUNT = 4
EXTRA_WORKLOADS = set(['details-v2', 'reviews-v4', 'reviews-v5','reviews-v6'])

METRICS_PARAMS = {"direction": "outbound", "reporter": "destination"}

def test_workload_list_endpoint(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_namespace()

    workload_list = kiali_client.request(method_name='workloadList', path={'namespace': bookinfo_namespace}).json()
    assert workload_list != None
    for workload in workload_list.get('workloads'):
      assert workload != None
      assert workload.get('name') != None and workload.get('name') != ''
      if ('traffic-generator' not in workload.get('name')):
          assert workload.get('istioSidecar') == True
          assert workload.get('versionLabel') == True
      assert workload.get('appLabel') == True

def test_diversity_in_workload_list_endpoint(kiali_client):
  bookinfo_namespace = conftest.get_bookinfo_namespace()

  try:
    # Add extra workloads that will be tested
    assert command_exec.oc_apply(conftest.WORKLOADS_FILE, bookinfo_namespace) == True

    with timeout(seconds=90, error_message='Timed out waiting for extra workloads creation'):
      while True:
        workload_list = kiali_client.request(method_name='workloadList', path={'namespace': bookinfo_namespace}).json()
        if workload_list != None and workload_list.get('workloads') != None:
          workload_names = set(list(map(lambda workload: workload.get('name'), workload_list.get('workloads'))))
          if EXTRA_WORKLOADS.issubset(workload_names):
            break

        time.sleep(1)

    # Dictionary that maps Workloads with its own types
    dicWorkloadType = {
      'details-v2': 'Pod',
      'reviews-v4': 'ReplicaSet',
      'reviews-v5': 'ReplicationController',
      'reviews-v6': 'StatefulSet'
    }

    for workload in workload_list.get('workloads'):
      if workload.get('name') in EXTRA_WORKLOADS:
        workloadType = dicWorkloadType[workload.get('name')]
        assert workload.get('type') == workloadType

  finally:
    assert command_exec.oc_delete(conftest.WORKLOADS_FILE, bookinfo_namespace) == True

    with timeout(seconds=90, error_message='Timed out waiting for extra workloads deletion'):
      print('Extra workloads added for this test:', EXTRA_WORKLOADS)
      while True:
        workload_list = kiali_client.request(method_name='workloadList', path={'namespace': bookinfo_namespace}).json()
        if workload_list != None and workload_list.get('workloads') != None:
          workload_names = set(list(map(lambda workload: workload.get('name'), workload_list.get('workloads'))))
          print('Still existing workloads:', workload_names)
          if EXTRA_WORKLOADS.intersection(workload_names) == set():
            break

        time.sleep(1)

def test_workload_details(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_namespace()

    workload = kiali_client.request(method_name='workloadDetails', path={'namespace': bookinfo_namespace, 'workload': WORKLOAD_TO_VALIDATE}).json()
    assert workload != None
    assert WORKLOAD_TO_VALIDATE in workload.get('name')
    assert WORKLOAD_TYPE in workload.get('type')
    assert 'labels' in workload
    assert 'pods' in workload
    assert 'services' in workload

def test_workload_metrics(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_namespace()

    workload = kiali_client.request(method_name='workloadMetrics', path={'namespace': bookinfo_namespace, 'workload': WORKLOAD_TO_VALIDATE},
                                    params=METRICS_PARAMS).json()

    assert workload != None

    metrics = workload.get('metrics')
    assert 'request_count' in metrics
    assert 'tcp_received' in metrics
    assert 'tcp_sent' in metrics

    histograms = workload.get('histograms')
    assert 'request_duration' in histograms
    assert 'request_size' in histograms
    assert 'response_size' in histograms

def test_workload_health(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_namespace()

    workload = kiali_client.request(method_name='workloadHealth', path={'namespace': bookinfo_namespace, 'workload': WORKLOAD_TO_VALIDATE}).json()
    assert workload != None
    assert WORKLOAD_TO_VALIDATE in workload.get('workloadStatus').get('name')
    assert 'requests' in workload

