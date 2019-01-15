import warnings

import pytest
import tests.conftest as conftest

@pytest.fixture(scope="session", autouse=True)
def before_all_tests(kiali_client):
    global swagger_method_list, tested_method_list
    swagger = kiali_client.swagger_parser.swagger
    swagger_method_list= []
    tested_method_list = ['Root','jaegerInfo', 'grafanaInfo', 'getStatus', 'getConfig', 'GetToken',
                          'namespaceList', 'namespaceMetrics','namespaceHealth','namespaceValidations',
                          'istioConfigList', 'istioConfigDetails', 'objectValidations', ''
                          'serviceList', 'serviceDetails', 'serviceMetrics', 'serviceHealth', 'serviceValidations',
                          'appHealth', 'appList', 'appDetails', 'appMetrics',
                          'workloadList', 'workloadDetails', 'workloadHealth', 'workloadMetrics',
                          'graphNamespaces', 'graphService', 'graphWorkload', 'graphApp', 'graphAppVersion', 'istioConfigDetailsSubtype',
                          'serviceDashboard', 'workloadDashboard', 'appDashboard']

    for key in swagger.operation:
        swagger_method_list.append(key)



def get_method_from_method_list(method_name):
    try:
        return tested_method_list[tested_method_list.index(method_name)]
    except ValueError:
        pytest.fail('Method not available on Tested Method List')


def evaluate_response(kiali_client, method_name, path=None, params=None, status_code_expected=200):
    response = kiali_client.request(method_name=get_method_from_method_list(method_name), path=path, params=params)
    assert response is not None
    try:
        assert response.status_code == status_code_expected
    except AssertionError:
        pytest.fail(response.content)
    assert response.json() is not None


def __test_swagger_coverage():
    difference_set = set(swagger_method_list) - set(tested_method_list)
    if len(difference_set) > 0:
        pytest.fail('Missing {0} Api Methods to Validate:'.format(str(len(difference_set))) + str(difference_set))
    else:
        pass

def test_swagger_double_api(kiali_client):
    swagger = kiali_client.swagger_parser.swagger

    for key, value in swagger.operation.items():
        assert not 'api/api' in value[0]

def test_root(kiali_client):
    evaluate_response(kiali_client, method_name='Root')


def test_jaeger_info(kiali_client):
    evaluate_response(kiali_client, method_name='jaegerInfo')


def test_grafana_info(kiali_client):
    evaluate_response(kiali_client, method_name='grafanaInfo')


def test_get_status(kiali_client):
    evaluate_response(kiali_client, method_name='getStatus')


def test_get_config(kiali_client):
    evaluate_response(kiali_client, method_name='getConfig')


def test_get_token(kiali_client):
    evaluate_response(kiali_client, method_name='GetToken')


def test_namespace_list(kiali_client):
    evaluate_response(kiali_client, method_name='namespaceList')

def test_namespace_metrics(kiali_client):
    evaluate_response(kiali_client, method_name='namespaceMetrics', path={'namespace': 'istio-system'})


def test_namespace_health(kiali_client):
    evaluate_response(kiali_client, method_name='namespaceHealth', path={'namespace': 'istio-system'})


def test_namespace_validations(kiali_client):
    evaluate_response(kiali_client, method_name='namespaceValidations', path={'namespace': 'istio-system'})


def test_istio_config_list(kiali_client):
    evaluate_response(kiali_client, method_name='istioConfigList', path={'namespace': 'istio-system'})


def test_istio_config_details(kiali_client):
    evaluate_response(kiali_client, method_name='istioConfigDetails', path={'namespace': 'istio-system', 'object_type': 'rules', 'object': 'promtcp'})


def test_object_validations(kiali_client):
    evaluate_response(kiali_client, method_name='objectValidations', path={'namespace': 'bookinfo', 'object_type': 'service', 'object': 'productpage'}, status_code_expected=400)
    evaluate_response(kiali_client, method_name='objectValidations', path={'namespace': 'istio-system', 'object_type': 'rules', 'object': 'promtcp'})



def test_istio_config_details_subtype(kiali_client):
    evaluate_response(kiali_client, method_name='istioConfigDetailsSubtype', path={'namespace': 'istio-system', 'object_type': 'templates', 'object_subtype': 'metrics', 'object': 'tcpbytereceived'} )

def test_service_list(kiali_client):
    evaluate_response(kiali_client, method_name='serviceList', path={'namespace': 'istio-system'})


def test_service_details(kiali_client):
    evaluate_response(kiali_client, method_name='serviceDetails',
                                           path={'namespace': 'istio-system', 'service': 'kiali'})

def test_service_metrics(kiali_client):
    evaluate_response(kiali_client, method_name='serviceMetrics',
                                        path={'namespace': 'istio-system', 'service': 'kiali'})

def test_service_health(kiali_client):
    evaluate_response(kiali_client, method_name='serviceHealth', path={'namespace': 'istio-system', 'service': 'kiali'})


def test_service_validations(kiali_client):
    evaluate_response(kiali_client, method_name='serviceValidations', path={'namespace': 'istio-system', 'service': 'kiali'})


def test_app_list(kiali_client):
    evaluate_response(kiali_client, method_name='appList', path={'namespace': 'istio-system'})

def test_app_metrics(kiali_client):
    evaluate_response(kiali_client,method_name='appMetrics', path={'namespace': 'istio-system', 'app': 'kiali'})


def test_app_details(kiali_client):
    evaluate_response(kiali_client, method_name='appDetails', path={'namespace': 'istio-system', 'app': 'kiali'})

def test_app_health(kiali_client):
    evaluate_response(kiali_client, method_name='appHealth', path={'namespace': 'istio-system', 'app': 'kiali'})


def test_workload_list(kiali_client):
    evaluate_response(kiali_client, method_name='workloadList', path={'namespace': 'istio-system'})


def test_workload_details(kiali_client):
    evaluate_response(kiali_client, method_name='workloadDetails', path={'namespace': 'bookinfo', 'workload':'details-v1'})

def test_workload_health(kiali_client):
    evaluate_response(kiali_client, method_name='workloadHealth', path={'namespace': 'bookinfo', 'workload':'details-v1'})

def test_workload_metrics(kiali_client):
    evaluate_response(kiali_client, method_name='workloadMetrics', path={'namespace': 'bookinfo', 'workload':'details-v1'})

def test_graph_namespaces(kiali_client):
    VERSIONED_APP_PARAMS = {'namespaces': 'bookinfo', 'graphType': 'versionedApp', 'duration': '60s'}
    WORKLOAD_PARAMS = {'namespaces': 'bookinfo', 'graphType': 'workload', 'duration': '60s'}
    APP_PARAMS = {'namespaces': 'bookinfo','graphType': 'app', 'duration': '60s'}

    evaluate_response(kiali_client, method_name='graphNamespaces', params=VERSIONED_APP_PARAMS)
    evaluate_response(kiali_client, method_name='graphNamespaces', params=WORKLOAD_PARAMS)
    evaluate_response(kiali_client, method_name='graphNamespaces', params=APP_PARAMS)


def test_graph_service(kiali_client):
    GRAPH_SERVICE_PATH = {'namespace': 'bookinfo', 'service': 'mongodb'}
    evaluate_response(kiali_client, method_name='graphService', path=GRAPH_SERVICE_PATH)


def test_graph_workload(kiali_client):
    GRAPH_WORKLOAD_PATH = {'namespace': 'bookinfo', 'workload': 'mongodb-v1'}
    evaluate_response(kiali_client, method_name='graphWorkload', path=GRAPH_WORKLOAD_PATH)

def test_graph_app_and_graph_app_version(kiali_client):
    GRAPH_APP_PARAMS_NOT_VALID = {'graphType': 'notValid'}
    GRAPH_APP_PARAMS_APP = {'graphType': 'app'}
    GRAPH_APP_PARAMS_VERSION = {'graphType': 'versionedApp'}
    GRAPH_APP_PARAMS_WORKLOAD = {'graphType': 'workload'}
    GRAPH_APP_PARAMS_SERVICE = {'graphType': 'service'}
    
    
    GRAPH_APP_PATH = {'namespace': 'bookinfo', 'app': 'reviews'}

    for method_name in ['graphApp', 'graphAppVersion']:

        # Default Request (It is expected because the graphType is set to Workload as default it will fail for default case)
        evaluate_response(kiali_client, method_name=method_name, path=GRAPH_APP_PATH, status_code_expected=400)

        # Workload (also equals to Default)
        evaluate_response(kiali_client, method_name=method_name, path=GRAPH_APP_PATH, status_code_expected=400,
                        params=GRAPH_APP_PARAMS_WORKLOAD)

        # Service
        evaluate_response(kiali_client, method_name=method_name, path=GRAPH_APP_PATH, status_code_expected=400,
                        params=GRAPH_APP_PARAMS_SERVICE)

        # Invalid Value
        evaluate_response(kiali_client, method_name=method_name, path=GRAPH_APP_PATH,
                        params=GRAPH_APP_PARAMS_NOT_VALID, status_code_expected=400)

        # App Graph
        evaluate_response(kiali_client, method_name=method_name, path=GRAPH_APP_PATH, status_code_expected=200,
                        params=GRAPH_APP_PARAMS_APP)

        # Versioned App Graph
        evaluate_response(kiali_client, method_name=method_name, path=GRAPH_APP_PATH, status_code_expected=200,
                        params=GRAPH_APP_PARAMS_VERSION)


def test_service_dashboard(kiali_client):
    SERVICE_DASHBOARD_PATH = {'namespace': 'bookinfo', 'service': 'details'}
    evaluate_response(kiali_client, method_name='serviceDashboard', path=SERVICE_DASHBOARD_PATH)

def test_workload_dashboard(kiali_client):
    WORKLOAD_DASHBOARD_PATH = {'namespace': 'bookinfo', 'workload':'details-v1'}
    evaluate_response(kiali_client, method_name='workloadDashboard', path=WORKLOAD_DASHBOARD_PATH)

def test_app_dashboard(kiali_client):
    APP_DASHBOARD_PATH = {'namespace': 'bookinfo', 'app':'ratings'}
    evaluate_response(kiali_client, method_name='appDashboard', path=APP_DASHBOARD_PATH)

def test_negative_400(kiali_client):

    INVALID_PARAMS_ISTIOCONFIGDETAILS = {'namespace': 'invalid', 'object_type': 'invalid', 'object': 'promtcp'}
    INVALID_PARAMS_GRAPHNAMESPACES = {'namespaces': 'bookinfo', 'graphType': 'versionedApp', 'duration': 'invalid'}

    evaluate_response(kiali_client, method_name='istioConfigDetails', path=INVALID_PARAMS_ISTIOCONFIGDETAILS, status_code_expected=400)
    evaluate_response(kiali_client, method_name='graphNamespaces', path=INVALID_PARAMS_GRAPHNAMESPACES, status_code_expected=400)


def test_negative_404(kiali_client):
    INVALID_PARAMS_SERVICEDETAILS = {'namespace': 'istio-system', 'service': 'invalid'}
    INVALID_PARAMS_WORKLOADDETAILS = {'namespace': 'invalid', 'workload': 'details-v1'}
    INVALID_PARAMS_APPDETAILS = {'namespace': 'invalid', 'app': 'ratings'}
    INVALID_PARAMS_ISTIOCONFIGDETAILS = {'namespace': 'invalid', 'object_type': 'rules', 'object': 'promtcp'}
    INVALID_PARAMS_SERVICEHEALTH = {'namespace': 'istio-system', 'service': 'invalid'}
    INVALID_PARAMS_WORKLOADHEALTH = {'namespace': 'bookinfo', 'workload': 'invalid'}

    evaluate_response(kiali_client, method_name='serviceDetails', path=INVALID_PARAMS_SERVICEDETAILS, status_code_expected=404)
    #evaluate_response(kiali_client, method_name='serviceHealth', path=INVALID_PARAMS_SERVICEHEALTH, status_code_expected=404)
    evaluate_response(kiali_client, method_name='workloadDetails', path=INVALID_PARAMS_WORKLOADDETAILS, status_code_expected=404)
    evaluate_response(kiali_client, method_name='appDetails', path=INVALID_PARAMS_APPDETAILS, status_code_expected=404)
    evaluate_response(kiali_client, method_name='istioConfigDetails', path=INVALID_PARAMS_ISTIOCONFIGDETAILS, status_code_expected=404)
    evaluate_response(kiali_client, method_name='workloadHealth', path=INVALID_PARAMS_WORKLOADHEALTH, status_code_expected=404)


def test_negative_500(kiali_client):    
    INVALID_PARAMS_SERVICEDETAILS = {'namespace': 'invalid', 'service': 'kiali'}
    INVALID_PARAMS_SERVICEHEALTH = {'namespace': 'invalid', 'service': 'kiali'}
    INVALID_PARAMS_APPHEALTH = {'namespace': 'invalid', 'app': 'kiali'}
    INVALID_PARAMS_WORKLOADHEALTH = {'namespace': 'invalid', 'workload': 'details-v1'}

    evaluate_response(kiali_client, method_name='serviceDetails', path=INVALID_PARAMS_SERVICEDETAILS, status_code_expected=500)
    evaluate_response(kiali_client, method_name='serviceHealth', path=INVALID_PARAMS_SERVICEHEALTH, status_code_expected=500)
    evaluate_response(kiali_client, method_name='appHealth', path=INVALID_PARAMS_APPHEALTH, status_code_expected=500)
    evaluate_response(kiali_client, method_name='workloadHealth', path=INVALID_PARAMS_WORKLOADHEALTH, status_code_expected=500)
