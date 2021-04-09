import pytest
import tests.conftest as conftest
from utils.common_utils import common_utils

bookinfo_namespace = conftest.get_bookinfo_namespace()


def test_app_node_details(kiali_client):
    graph_type = 'app'
    response = common_utils.get_response(kiali_client, method_name='graphApp', path={'namespace':bookinfo_namespace, 'app':'details'}, params={'graphType':graph_type})
    verify_response(response, graph_type=graph_type)

def test_app_node_details_invalidate_app_name(kiali_client):
    graph_type = 'app'
    response = common_utils.get_response(kiali_client, method_name='graphApp', path={'namespace':bookinfo_namespace, 'app':'invalidAppName'}, params={'graphType':graph_type})

    verify_response_no_data(response, graph_type=graph_type)

def test_versioned_app_node_details(kiali_client):
    graph_type = 'versionedApp'
    response = common_utils.get_response(kiali_client, method_name='graphAppVersion', path={'namespace':bookinfo_namespace, 'app':'reviews', 'version':'v1'}, params={'graphType':graph_type})
    verify_response(response, graph_type=graph_type)

def test_services_node_details(kiali_client):
    graph_type = 'versionedApp'
    response = common_utils.get_response(kiali_client, method_name='graphService', path={'namespace':bookinfo_namespace, 'service':'details'}, params={'graphType':graph_type})
    verify_response(response, graph_type=graph_type)

def test_workoad_node_details(kiali_client):
    graph_type = 'workload'
    response = common_utils.get_response(kiali_client, method_name='graphWorkload', path={'namespace':bookinfo_namespace, 'workload':'reviews-v2'}, params={'graphType':graph_type})
    verify_response(response, graph_type=graph_type)

def test_workoad_node_details_invalid_workoad_name(kiali_client):
    graph_type = 'workload'
    response = common_utils.get_response(kiali_client, method_name='graphWorkload', path={'namespace':bookinfo_namespace, 'workload':'invalidWorkloadName'}, params={'graphType':graph_type})

    verify_response_no_data(response, graph_type=graph_type)

#############

def verify_response(response = None, graph_type=None):
    assert response.status_code == 200
    assert response.json().get('graphType') == graph_type
    assert len(response.json().get('elements').get('nodes')) > 0
    assert len(response.json().get('elements').get('edges')) > 0

def verify_response_no_data(response = None, graph_type=None):
    assert response.status_code == 200
    assert response.json().get('graphType') == graph_type
    assert len(response.json().get('elements').get('nodes')) == 0
    assert len(response.json().get('elements').get('edges')) == 0