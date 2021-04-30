import pytest
import tests.conftest as conftest
from utils.common_utils import common_utils

bookinfo_namespace = conftest.get_bookinfo_namespace()

INVALID_PARAMS_NAMESPACE_HEALTH = {'namespace':'invalid'}
INVALID_PATH_WORKLOAD_HEALTH_DEPLOYMENT = {'namespace':'invalid', 'workload':'invalid'}
INVALID_PARAM_WORKLOAD_HEALTH_DEPLOYMENT = {'type':'invalid', 'rateInterval':'invalid'}
INVALID_NAMESPACE_WORKLOAD_HEALTH_DEPLOYMENT = {'namespace':'invalid', 'workload':'details-v1'}
INVALID_WORKLOAD_HEALTH_DEPLOYMENT_WORKLOAD = {'namespace':bookinfo_namespace, 'workload':'invalid'}
VALID_PATH_WORKLOAD_HEALTH_DEPLOYMENT = {'namespace':bookinfo_namespace, 'workload':'details-v1'}
VALID_PARAM_WORKLOAD_HEALTH_DEPLOYMENT = {'type':'Deployment', 'rateInterval':'60s'}
INVALID_TYPE_WORKLOAD_HEALTH_DEPLOYMENT = {'type':'invalid', 'rateInterval':'60s'}
INVALID_RATE_INTERVAL_WORKLOAD_HEALTH_DEPLOYMENT = {'type':'Deployment', 'rateInterval':'invalid'}


INVALID_PATH_WORKLOAD_HEALTH_REPLICA_SET = {'namespace':'invalid', 'workload':'invalid'}
INVALID_PARAM_WORKLOAD_HEALTH_REPLICA_SET = {'type':'invalid', 'rateInterval':'invalid'}
INVALID_NAMESPACE_WORKLOAD_HEALTH_REPLICA_SET = {'namespace':'invalid', 'workload':'kiali-traffic-generator'}
INVALID_WORKLOAD_HEALTH_REPLICA_SET_WORKLOAD = {'namespace':bookinfo_namespace, 'workload':'invalid'}
VALID_PATH_WORKLOAD_HEALTH_REPLICA_SET = {'namespace':bookinfo_namespace, 'workload':'kiali-traffic-generator'}
VALID_PARAM_WORKLOAD_HEALTH_REPLICA_SET = {'type':'ReplicaSet', 'rateInterval':'60s'}
INVALID_TYPE_WORKLOAD_HEALTH_REPLICA_SET = {'type':'invalid', 'rateInterval':'60s'}
INVALID_RATE_INTERVAL_WORKLOAD_HEALTH_REPLICA_SET = {'type':'ReplicaSet', 'rateInterval':'invalid'}



def test_workload_health_deployment(kiali_client):
    workload_type = 'Deployment'
    workload_name = 'details-v1'
    response = common_utils.get_response(kiali_client, method_name='workloadHealth', path={'namespace':bookinfo_namespace, 'workload':workload_name}, params={'type':workload_type, 'rateInterval':'60s'})

    assert response.json().get('workloadStatus') is not None
    assert workload_name == response.json().get('workloadStatus').get('name')

def test_workload_health_replicaset(kiali_client):
    workload_type = 'ReplicaSet'
    workload_name = 'kiali-traffic-generator'
    response = common_utils.get_response(kiali_client, method_name='workloadHealth', path={'namespace':bookinfo_namespace, 'workload':workload_name}, params={'type':workload_type, 'rateInterval':'60s'})

    assert response.json().get('workloadStatus') is not None
    assert workload_name == response.json().get('workloadStatus').get('name')

def test_service_health_deployment(kiali_client):
    service_name = 'ratings'
    response = common_utils.get_response(kiali_client, method_name='serviceHealth', path={'namespace':bookinfo_namespace, 'service':service_name}, params={'rateInterval':'60s'})

    assert response.json().get('requests') is not None

def test_namespace_health_workload(kiali_client):
    type_ = 'workload'
    response = common_utils.get_response(kiali_client, method_name='namespaceHealth', path={'namespace':bookinfo_namespace}, params={'type':type_, 'rateInterval':'60s'})

    assert response.json().get('ratings-v1') is not None

def test_namespace_health_service(kiali_client):
    type_ = 'service'
    response = common_utils.get_response(kiali_client, method_name='namespaceHealth', path={'namespace':bookinfo_namespace}, params={'type':type_, 'rateInterval':'60s'})

    assert response.json().get('details') is not None

def test_namespace_health_app(kiali_client):
    type_ = 'app'
    response = common_utils.get_response(kiali_client, method_name='namespaceHealth', path={'namespace':bookinfo_namespace}, params={'type':type_, 'rateInterval':'60s'})

    assert response.json().get('details') is not None

def test_namespace_health_app_invalid_namespace_negative(kiali_client):

    response = common_utils.get_response(kiali_client, method_name='namespaceHealth', path=INVALID_PARAMS_NAMESPACE_HEALTH, params={'type':'app','rateInterval':'60s'},status_code_expected=403)

def test_namespace_health_service_invalid_namespace_negative(kiali_client):

    response = common_utils.get_response(kiali_client, method_name='namespaceHealth', path=INVALID_PARAMS_NAMESPACE_HEALTH, params={'type':'service','rateInterval':'60s'},status_code_expected=403)

def test_namespace_health_workload_invalid_namespace_negative(kiali_client):

    response = common_utils.get_response(kiali_client, method_name='namespaceHealth', path=INVALID_PARAMS_NAMESPACE_HEALTH, params={'type':'workload','rateInterval':'60s'},status_code_expected=403)

def test_namespace_health_app_invalid_namespace_invalid_rateinterval_negative(kiali_client):

    INVALID_APP_QUERY_PARAMS_NAMESPACE_HEALTH = {'type':'app','rateInterval':'invalid'}

    response = common_utils.get_response(kiali_client, method_name='namespaceHealth', path=INVALID_PARAMS_NAMESPACE_HEALTH, params=INVALID_APP_QUERY_PARAMS_NAMESPACE_HEALTH,status_code_expected=403)

def test_namespace_health_service_invalid_namespace_invalid_rateinterval_negative(kiali_client):

    INVALID_SERVICE_QUERY_PARAMS_NAMESPACE_HEALTH = {'type':'service','rateInterval':'invalid'}

    response = common_utils.get_response(kiali_client, method_name='namespaceHealth', path=INVALID_PARAMS_NAMESPACE_HEALTH, params=INVALID_SERVICE_QUERY_PARAMS_NAMESPACE_HEALTH,status_code_expected=403)

def test_namespace_health_workload_invalid_namespace_invalid_rateinterval_negative(kiali_client):

    INVALID_WORKLOAD_QUERY_PARAMS_NAMESPACE_HEALTH = {'type':'workload','rateInterval':'invalid'}

    response = common_utils.get_response(kiali_client, method_name='namespaceHealth', path=INVALID_PARAMS_NAMESPACE_HEALTH, params=INVALID_WORKLOAD_QUERY_PARAMS_NAMESPACE_HEALTH,status_code_expected=403)

def test_namespace_health_invalid_type_negative(kiali_client):

    INVALID_RATEINTERVALQUERY_PARAMS_NAMESPACE_HEALTH = {'type':'invalid','rateInterval':'60s'}

    response = common_utils.get_response(kiali_client, method_name='namespaceHealth', path={'namespace':bookinfo_namespace}, params=INVALID_RATEINTERVALQUERY_PARAMS_NAMESPACE_HEALTH,status_code_expected=400)

def test_namespace_health_invalid_type_invalid_rateinterval_negative(kiali_client):

    INVALID_TYPE_QUERY_PARAMS_NAMESPACE_HEALTH = {'type':'invalid','rateInterval':'invalid'}

    response = common_utils.get_response(kiali_client, method_name='namespaceHealth', path={'namespace':bookinfo_namespace}, params=INVALID_TYPE_QUERY_PARAMS_NAMESPACE_HEALTH,status_code_expected=400)

def test_namespace_health_invalid_negative(kiali_client):

    INVALID_QUERY_PARAMS_NAMESPACE_HEALTH = {'type':'invalid','rateInterval':'invalid'}

    response = common_utils.get_response(kiali_client, method_name='namespaceHealth', path=INVALID_PARAMS_NAMESPACE_HEALTH, params=INVALID_QUERY_PARAMS_NAMESPACE_HEALTH,status_code_expected=400)

def test_namespace_health_invalid_namespace_invalid_type_negative(kiali_client):

    INVALID_TYPE_QUERY_PARAMS_NAMESPACE_HEALTH = {'type':'invalid','rateInterval':'60s'}

    response = common_utils.get_response(kiali_client, method_name='namespaceHealth', path=INVALID_PARAMS_NAMESPACE_HEALTH, params=INVALID_TYPE_QUERY_PARAMS_NAMESPACE_HEALTH,status_code_expected=400)

def test_namespace_health_app_invalid_rateinterval_negative(kiali_client):

    INVALID_APP_QUERY_PARAMS_NAMESPACE_HEALTH = {'type':'app','rateInterval':'invalid'}

    response = common_utils.get_response(kiali_client, method_name='namespaceHealth', path={'namespace':bookinfo_namespace}, params=INVALID_APP_QUERY_PARAMS_NAMESPACE_HEALTH,status_code_expected=500)

def test_namespace_health_service_invalid_rateinterval_negative(kiali_client):

    INVALID_SERVICE_QUERY_PARAMS_NAMESPACE_HEALTH = {'type':'service','rateInterval':'invalid'}

    response = common_utils.get_response(kiali_client, method_name='namespaceHealth', path={'namespace':bookinfo_namespace}, params=INVALID_SERVICE_QUERY_PARAMS_NAMESPACE_HEALTH,status_code_expected=500)

def test_namespace_health_workload_invalid_rateinterval_negative(kiali_client):

    INVALID_WORKLOAD_QUERY_PARAMS_NAMESPACE_HEALTH = {'type':'workload','rateInterval':'invalid'}

    response = common_utils.get_response(kiali_client, method_name='namespaceHealth', path={'namespace':bookinfo_namespace}, params=INVALID_WORKLOAD_QUERY_PARAMS_NAMESPACE_HEALTH,status_code_expected=500)


def test_workload_health_invalid_replicaset_negative(kiali_client):
    workload_type = 'ReplicaSet'
    workload_name = 'details-v1'
    response = common_utils.get_response(kiali_client, method_name='workloadHealth', path={'namespace':bookinfo_namespace, 'workload':workload_name}, params={'type':workload_type, 'rateInterval':'60s'},status_code_expected=404)

def test_workload_health_deployment_invalid_namespace_negative(kiali_client):

    response = common_utils.get_response(kiali_client, method_name='workloadHealth', path=INVALID_NAMESPACE_WORKLOAD_HEALTH_DEPLOYMENT, params=VALID_PARAM_WORKLOAD_HEALTH_DEPLOYMENT,status_code_expected=403)

def test_workload_health_deployment_invalid_workload_negative(kiali_client):

    response = common_utils.get_response(kiali_client, method_name='workloadHealth', path=INVALID_WORKLOAD_HEALTH_DEPLOYMENT_WORKLOAD, params=VALID_PARAM_WORKLOAD_HEALTH_DEPLOYMENT,status_code_expected=404)

def test_workload_health_deployment_invalid_rateinterval_negative(kiali_client):

    response = common_utils.get_response(kiali_client, method_name='workloadHealth', path=VALID_PATH_WORKLOAD_HEALTH_DEPLOYMENT, params=INVALID_RATE_INTERVAL_WORKLOAD_HEALTH_DEPLOYMENT,status_code_expected=500)

def test_workload_health_deployment_invalid_type_invalid_rateinterval_negative(kiali_client):

    response = common_utils.get_response(kiali_client, method_name='workloadHealth', path=VALID_PATH_WORKLOAD_HEALTH_DEPLOYMENT, params=INVALID_PARAM_WORKLOAD_HEALTH_DEPLOYMENT,status_code_expected=500)

def test_workload_health_deployment_invalid_workload_invalid_type_negative(kiali_client):

    response = common_utils.get_response(kiali_client, method_name='workloadHealth', path=INVALID_WORKLOAD_HEALTH_DEPLOYMENT_WORKLOAD, params=INVALID_TYPE_WORKLOAD_HEALTH_DEPLOYMENT,status_code_expected=404)

def test_workload_health_deployment_invalid_namespace_invalid_workload_negative(kiali_client):
        
    response = common_utils.get_response(kiali_client, method_name='workloadHealth', path=INVALID_PATH_WORKLOAD_HEALTH_DEPLOYMENT, params=VALID_PARAM_WORKLOAD_HEALTH_DEPLOYMENT,status_code_expected=403)

def test_workload_health_deployment_invalid_namespace_invalid_rateinterval_negative(kiali_client):

    response = common_utils.get_response(kiali_client, method_name='workloadHealth', path=INVALID_NAMESPACE_WORKLOAD_HEALTH_DEPLOYMENT, params=INVALID_RATE_INTERVAL_WORKLOAD_HEALTH_DEPLOYMENT,status_code_expected=403)

def test_workload_health_deployment_invalid_namespace_invalid_type_negative(kiali_client):
   
    response = common_utils.get_response(kiali_client, method_name='workloadHealth', path=INVALID_NAMESPACE_WORKLOAD_HEALTH_DEPLOYMENT, params=INVALID_TYPE_WORKLOAD_HEALTH_DEPLOYMENT,status_code_expected=403)

def test_workload_health_deployment_invalid_workload_invalid_rateinterval_negative(kiali_client):
   
    response = common_utils.get_response(kiali_client, method_name='workloadHealth', path=INVALID_WORKLOAD_HEALTH_DEPLOYMENT_WORKLOAD, params=INVALID_RATE_INTERVAL_WORKLOAD_HEALTH_DEPLOYMENT,status_code_expected=500)

def test_workload_health_deployment_invalid_workload_invalid_query_param_negative(kiali_client):

    response = common_utils.get_response(kiali_client, method_name='workloadHealth', path=INVALID_WORKLOAD_HEALTH_DEPLOYMENT_WORKLOAD, params=INVALID_PARAM_WORKLOAD_HEALTH_DEPLOYMENT,status_code_expected=500)

def test_workload_health_deployment_invalid_path_invalid_type_negative(kiali_client):
   
    response = common_utils.get_response(kiali_client, method_name='workloadHealth', path=INVALID_PATH_WORKLOAD_HEALTH_DEPLOYMENT, params=INVALID_TYPE_WORKLOAD_HEALTH_DEPLOYMENT,status_code_expected=403)

def test_workload_health_deployment_invalid_namespace_invalid_query_param_negative(kiali_client):
   
    response = common_utils.get_response(kiali_client, method_name='workloadHealth', path=INVALID_NAMESPACE_WORKLOAD_HEALTH_DEPLOYMENT, params=INVALID_PARAM_WORKLOAD_HEALTH_DEPLOYMENT,status_code_expected=403)

def test_workload_health_deployment_invalid_path_invalid_rateinterval_negative(kiali_client):
   
    response = common_utils.get_response(kiali_client, method_name='workloadHealth', path=INVALID_PATH_WORKLOAD_HEALTH_DEPLOYMENT, params=INVALID_RATE_INTERVAL_WORKLOAD_HEALTH_DEPLOYMENT,status_code_expected=403)

def test_workload_health_deployment_invalid_path_invalid_query_param_negative(kiali_client):
   
    response = common_utils.get_response(kiali_client, method_name='workloadHealth', path=INVALID_PATH_WORKLOAD_HEALTH_DEPLOYMENT, params=INVALID_PARAM_WORKLOAD_HEALTH_DEPLOYMENT,status_code_expected=403)

def test_workload_health_replica_set_invalid_namespace_negative(kiali_client):

    response = common_utils.get_response(kiali_client, method_name='workloadHealth', path=INVALID_NAMESPACE_WORKLOAD_HEALTH_REPLICA_SET, params=VALID_PARAM_WORKLOAD_HEALTH_REPLICA_SET,status_code_expected=403)

def test_workload_health_replica_set_invalid_workload_negative(kiali_client):

    response = common_utils.get_response(kiali_client, method_name='workloadHealth', path=INVALID_WORKLOAD_HEALTH_REPLICA_SET_WORKLOAD, params=VALID_PARAM_WORKLOAD_HEALTH_REPLICA_SET,status_code_expected=404)

def test_workload_health_replica_set_invalid_rateinterval_negative(kiali_client):

    response = common_utils.get_response(kiali_client, method_name='workloadHealth', path=VALID_PATH_WORKLOAD_HEALTH_REPLICA_SET, params=INVALID_RATE_INTERVAL_WORKLOAD_HEALTH_REPLICA_SET,status_code_expected=500)

def test_workload_health_replica_set_invalid_type_invalid_rateinterval_negative(kiali_client):

    response = common_utils.get_response(kiali_client, method_name='workloadHealth', path=VALID_PATH_WORKLOAD_HEALTH_REPLICA_SET, params=INVALID_PARAM_WORKLOAD_HEALTH_REPLICA_SET,status_code_expected=500)

def test_workload_health_replica_set_invalid_workload_invalid_type_negative(kiali_client):

    response = common_utils.get_response(kiali_client, method_name='workloadHealth', path=INVALID_WORKLOAD_HEALTH_REPLICA_SET_WORKLOAD, params=INVALID_TYPE_WORKLOAD_HEALTH_REPLICA_SET,status_code_expected=404)

def test_workload_health_replica_set_invalid_namespace_invalid_workload_negative(kiali_client):
        
    response = common_utils.get_response(kiali_client, method_name='workloadHealth', path=INVALID_PATH_WORKLOAD_HEALTH_REPLICA_SET, params=VALID_PARAM_WORKLOAD_HEALTH_REPLICA_SET,status_code_expected=403)

def test_workload_health_replica_set_invalid_namespace_invalid_rateinterval_negative(kiali_client):

    response = common_utils.get_response(kiali_client, method_name='workloadHealth', path=INVALID_NAMESPACE_WORKLOAD_HEALTH_REPLICA_SET, params=INVALID_RATE_INTERVAL_WORKLOAD_HEALTH_REPLICA_SET,status_code_expected=403)

def test_workload_health_replica_set_invalid_namespace_invalid_type_negative(kiali_client):
   
    response = common_utils.get_response(kiali_client, method_name='workloadHealth', path=INVALID_NAMESPACE_WORKLOAD_HEALTH_REPLICA_SET, params=INVALID_TYPE_WORKLOAD_HEALTH_REPLICA_SET,status_code_expected=403)

def test_workload_health_replica_set_invalid_workload_invalid_rateinterval_negative(kiali_client):
   
    response = common_utils.get_response(kiali_client, method_name='workloadHealth', path=INVALID_WORKLOAD_HEALTH_REPLICA_SET_WORKLOAD, params=INVALID_RATE_INTERVAL_WORKLOAD_HEALTH_REPLICA_SET,status_code_expected=500)

def test_workload_health_replica_set_invalid_workload_invalid_query_param_negative(kiali_client):

    response = common_utils.get_response(kiali_client, method_name='workloadHealth', path=INVALID_WORKLOAD_HEALTH_REPLICA_SET_WORKLOAD, params=INVALID_PARAM_WORKLOAD_HEALTH_REPLICA_SET,status_code_expected=500)

def test_workload_health_replica_set_invalid_path_invalid_type_negative(kiali_client):
   
    response = common_utils.get_response(kiali_client, method_name='workloadHealth', path=INVALID_PATH_WORKLOAD_HEALTH_REPLICA_SET, params=INVALID_TYPE_WORKLOAD_HEALTH_REPLICA_SET,status_code_expected=403)

def test_workload_health_replica_set_invalid_namespace_invalid_query_param_negative(kiali_client):
   
    response = common_utils.get_response(kiali_client, method_name='workloadHealth', path=INVALID_NAMESPACE_WORKLOAD_HEALTH_REPLICA_SET, params=INVALID_PARAM_WORKLOAD_HEALTH_REPLICA_SET,status_code_expected=403)

def test_workload_health_replica_set_invalid_path_invalid_rateinterval_negative(kiali_client):
   
    response = common_utils.get_response(kiali_client, method_name='workloadHealth', path=INVALID_PATH_WORKLOAD_HEALTH_REPLICA_SET, params=INVALID_RATE_INTERVAL_WORKLOAD_HEALTH_REPLICA_SET,status_code_expected=403)

def test_workload_health_replica_set_invalid_path_invalid_query_param_negative(kiali_client):
   
    response = common_utils.get_response(kiali_client, method_name='workloadHealth', path=INVALID_PATH_WORKLOAD_HEALTH_REPLICA_SET, params=INVALID_PARAM_WORKLOAD_HEALTH_REPLICA_SET,status_code_expected=403)

