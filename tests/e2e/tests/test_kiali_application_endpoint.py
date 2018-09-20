import json
import tests.conftest as conftest

APPLICATION_TO_VALIDATE = 'productpage'

PARAMS = {'graphType': 'versionedApp', 'duration': '60s'}

def test_application_list_endpoint(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_endpoint()

    app_list = kiali_client.app_list(namespace=bookinfo_namespace)
    assert app_list != None
    for app in app_list.get('applications'):
        assert app.get('istioSidecar') == True

    assert app_list.get('namespace').get('name') == bookinfo_namespace

def test_application_details_endpoint(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_endpoint()

    app_details = kiali_client.app_details(namespace=bookinfo_namespace, app=APPLICATION_TO_VALIDATE)

    assert app_details != None
    assert app_details.get('namespace').get('name') == bookinfo_namespace
    assert 'workloads' in app_details and (len(app_details.get('workloads')) > 0)
    assert app_details.get('workloads')[0].get('istioSidecar') == True

def test_application_health_endpoint(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_endpoint()

    app_health = kiali_client.app_health(namespace=bookinfo_namespace, app=APPLICATION_TO_VALIDATE)
    assert app_health != None
    assert app_health.get('envoy') != None
    assert app_health.get('deploymentStatuses')
    assert app_health.get('requests')

def test_application_metrics_endpoint(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_endpoint()

    app_metrics = kiali_client.app_metrics(namespace=bookinfo_namespace, app=APPLICATION_TO_VALIDATE)
    assert app_metrics != None
    assert app_metrics.get('source') != None
    assert app_metrics.get('source').get('metrics') != None
    assert app_metrics.get('dest').get('metrics') != None

