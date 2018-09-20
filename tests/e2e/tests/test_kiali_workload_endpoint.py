import pytest
import tests.conftest as conftest

WORKLOAD_TO_VALIDATE = 'details-v1'
WORKLOAD_TYPE = 'Deployment'

def test_workload_list_endpoint(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_endpoint()

    workload_list = kiali_client.workload_list(namespace=bookinfo_namespace)
    assert workload_list != None
    for workload in workload_list.get('workloads'):
        assert workload.get('istioSidecar') == True

def test_workload_details(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_endpoint()

    workload = kiali_client.workload_details(namespace=bookinfo_namespace, workload=WORKLOAD_TO_VALIDATE)
    assert workload != None
    assert WORKLOAD_TO_VALIDATE in workload.get('name')
    assert WORKLOAD_TYPE in workload.get('type')

def test_workload_metrics(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_endpoint()

    workload = kiali_client.workload_metrics(namespace=bookinfo_namespace, workload=WORKLOAD_TO_VALIDATE)
    assert workload != None
    metrics = workload.get('source').get('metrics')
    assert 'request_count_in' in metrics
    assert 'request_count_out' in metrics

def test_workload_health(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_endpoint()

    workload = kiali_client.workload_health(namespace=bookinfo_namespace, workload=WORKLOAD_TO_VALIDATE)
    assert workload != None
    assert WORKLOAD_TO_VALIDATE in workload.get('deploymentStatus').get('name')

def test_workload_istio_validations(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_endpoint()

    workload = kiali_client.workload_istio_validations(namespace=bookinfo_namespace, workload=WORKLOAD_TO_VALIDATE)
    assert workload != None
    wp = workload.get('pod')
    assert wp != None
    assert WORKLOAD_TO_VALIDATE in wp.get(list(wp.keys())[0]).get('name')
    assert wp.get(list(wp.keys())[0]).get('valid') == True
