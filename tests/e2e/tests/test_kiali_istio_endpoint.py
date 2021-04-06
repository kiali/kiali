import pytest
import tests.conftest as conftest

OBJECT_TYPE = 'virtualservices'
OBJECT_TYPE_SINGLE = 'virtualservice'
bookinfo_namespace = conftest.get_bookinfo_namespace()

def test_istio_config_list(kiali_client):
    
    json = kiali_client.request(method_name='istioConfigList', path={'namespace': bookinfo_namespace}).json()

    assert json != None
    assert "destinationRules" in json
    assert json.get('destinationRules') != None
    assert bookinfo_namespace in json.get('namespace').get('name')

def test_istio_namespace_validations_endpoint(kiali_client):
    
    istio_validations = kiali_client.request(method_name='istioConfigList', path={'namespace': bookinfo_namespace}, params={'validate': 'true'}).json()

    assert istio_validations != None
    assert "validations" in istio_validations

def test_istio_object_type(kiali_client):

    istio_object_type = kiali_client.request(method_name='istioConfigDetails',
                        path={'namespace': bookinfo_namespace, 'object_type': OBJECT_TYPE, 'object': bookinfo_namespace}).json()
    assert istio_object_type != None
    assert "destinationRule" in istio_object_type
    assert bookinfo_namespace in istio_object_type.get('namespace').get('name')

def test_istio_object_istio_validations(kiali_client):

    istio_validations = kiali_client.request(method_name='istioConfigDetails',
                            path={'namespace': bookinfo_namespace, 'object_type': OBJECT_TYPE, 'object': bookinfo_namespace}, params={'validate': 'true'}).json()

    assert istio_validations != None
    assert istio_validations.get('validation') != None
    assert bookinfo_namespace in istio_validations.get('validation').get('name')
    assert OBJECT_TYPE_SINGLE in istio_validations.get('validation').get('objectType')

def test_istio_config_authorization_policies(kiali_client):
    
    istio_policies = kiali_client.request(method_name='istioConfigList', path={'namespace': bookinfo_namespace}, params={'objects': 'authorizationpolicies'}).json()

    assert istio_policies != None
    assert "virtualServices" in istio_policies
    assert istio_policies.get('virtualServices') != None
    assert bookinfo_namespace in istio_policies.get('namespace').get('name')

def test_istio_permissions_namespaces(kiali_client):
    
    istio_namespace = kiali_client.request(method_name='getPermissions', params={'namespaces': bookinfo_namespace}).json()
    
    assert istio_namespace != None
    assert "bookinfo" in istio_namespace
    assert istio_namespace.get('bookinfo') != None
    gateway = istio_namespace.get('bookinfo').get('authorizationpolicies')
    assert gateway != None

def test_istio_config_envoyfilters(kiali_client):
    
    istio_config_envoyfilters = kiali_client.request(method_name='istioConfigList', path={'namespace': bookinfo_namespace}, params={'objects': 'envoyfilters', 'validate': 'true'}).json()
    assert istio_config_envoyfilters != None
    assert "envoyFilters" in istio_config_envoyfilters
    assert istio_config_envoyfilters.get('envoyFilters') != None

def test_istio_config_gateways(kiali_client):
    
    istio_config_gateways = kiali_client.request(method_name='istioConfigList', path={'namespace': bookinfo_namespace}, params={'objects': 'gateways', 'validate': 'true'}).json()

    assert istio_config_gateways != None
    assert "gateways" in istio_config_gateways
    assert istio_config_gateways.get('gateways') != None

def test_istio_config_authorizationpolicies(kiali_client):
    
    istio_config_authorizationpolicies = kiali_client.request(method_name='istioConfigList', path={'namespace': bookinfo_namespace}, params={'objects': 'authorizationpolicies', 'validate': 'true'}).json()

    assert istio_config_authorizationpolicies != None
    assert "authorizationPolicies" in istio_config_authorizationpolicies
    assert istio_config_authorizationpolicies.get('authorizationPolicies') != None

def test_istio_config_destinationrules(kiali_client):
    
    istio_config_destinationrules = kiali_client.request(method_name='istioConfigList', path={'namespace': bookinfo_namespace}, params={'objects': 'destinationrules', 'validate': 'true'}).json()

    assert istio_config_destinationrules != None
    assert "destinationRules" in istio_config_destinationrules
    assert istio_config_destinationrules.get('destinationRules') != None
    istio_destinationrules = istio_config_destinationrules.get('destinationRules').get('permissions')
    assert istio_destinationrules != None

def test_istio_config_peerauthentications(kiali_client):
    
    istio_config_peerauthentications = kiali_client.request(method_name='istioConfigList', path={'namespace': bookinfo_namespace}, params={'objects': 'peerauthentications', 'validate': 'true'}).json()

    assert istio_config_peerauthentications != None
    assert "peerAuthentications" in istio_config_peerauthentications
    assert istio_config_peerauthentications.get('peerAuthentications') != None

def test_istio_config_requestauthentication(kiali_client):
    
    istio_config_requestauthentication = kiali_client.request(method_name='istioConfigList', path={'namespace': bookinfo_namespace}, params={'objects': 'requestauthentication', 'validate': 'true'}).json()

    assert istio_config_requestauthentication != None
    assert "requestAuthentications" in istio_config_requestauthentication
    assert istio_config_requestauthentication.get('requestAuthentications') != None

def test_istio_config_serviceentry(kiali_client):
    
    istio_config_serviceentry = kiali_client.request(method_name='istioConfigList', path={'namespace': bookinfo_namespace}, params={'objects': 'serviceentry', 'validate': 'true'}).json()

    assert istio_config_serviceentry != None
    assert "serviceEntries" in istio_config_serviceentry
    assert istio_config_serviceentry.get('serviceEntries') != None

def test_istio_config_sidecar(kiali_client):
    
    istio_config_sidecar = kiali_client.request(method_name='istioConfigList', path={'namespace': bookinfo_namespace}, params={'objects': 'sidecar', 'validate': 'true'}).json()

    assert istio_config_sidecar != None
    assert "sidecars" in istio_config_sidecar
    assert istio_config_sidecar.get('sidecars') != None

def test_istio_config_virtualservice(kiali_client):
    
    istio_config_virtualservice = kiali_client.request(method_name='istioConfigList', path={'namespace': bookinfo_namespace}, params={'objects': 'virtualservice', 'validate': 'true'}).json()

    assert istio_config_virtualservice != None
    assert "virtualServices" in istio_config_virtualservice
    assert istio_config_virtualservice.get('virtualServices') != None
    istio_virtualservice = istio_config_virtualservice.get('virtualServices').get('permissions')
    assert istio_virtualservice != None

def test_istio_config_workloadentry(kiali_client):
    
    istio_config_workloadentry = kiali_client.request(method_name='istioConfigList', path={'namespace': bookinfo_namespace}, params={'objects': 'workloadentry', 'validate': 'true'}).json()

    assert istio_config_workloadentry != None
    assert "workloadEntries" in istio_config_workloadentry
    assert istio_config_workloadentry.get('workloadEntries') != None