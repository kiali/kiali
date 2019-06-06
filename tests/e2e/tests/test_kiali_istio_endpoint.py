import pytest
import tests.conftest as conftest

OBJECT_TYPE = 'virtualservices'
OBJECT_TYPE_SINGLE = 'virtualservice'
OBJECT = conftest.get_bookinfo_namespace() + "-vs"

def test_istio_config_list(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_namespace()
    json = kiali_client.request(method_name='istioConfigList', path={'namespace': bookinfo_namespace}).json()

    assert json != None
    assert "destinationRules" in json
    assert json.get('destinationRules') != None
    assert bookinfo_namespace in json.get('namespace').get('name')

def test_istio_namespace_validations_endpoint(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_namespace()
    istio_validations = kiali_client.request(method_name='istioConfigList', path={'namespace': bookinfo_namespace}, params={'validate': 'true'}).json()

    assert istio_validations != None
    assert "validations" in istio_validations

def test_istio_object_type(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_namespace()

    istio_object_type = kiali_client.request(method_name='istioConfigDetails',
                        path={'namespace': bookinfo_namespace, 'object_type': OBJECT_TYPE, 'object': OBJECT}).json()
    assert istio_object_type != None
    assert "destinationRule" in istio_object_type
    assert bookinfo_namespace in istio_object_type.get('namespace').get('name')

def test_istio_object_istio_validations(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_namespace()

    istio_validations = kiali_client.request(method_name='istioConfigDetails',
                            path={'namespace': bookinfo_namespace, 'object_type': OBJECT_TYPE, 'object': OBJECT}, params={'validate': 'true'}).json()

    assert istio_validations != None
    assert istio_validations.get('validation') != None
    assert OBJECT in istio_validations.get('validation').get('name')
    assert OBJECT_TYPE_SINGLE in istio_validations.get('validation').get('objectType')
