import pytest
import tests.conftest as conftest

OBJECT_TYPE = 'virtualservices'

def test_istio_endpoint(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_endpoint()
    istio = kiali_client.istio(namespace=bookinfo_namespace)

    assert istio != None
    assert "destinationRules" in istio
    assert istio.get('destinationRules') != None
    assert bookinfo_namespace in istio.get('namespace').get('name')

def test_istio_validations_endpoint(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_endpoint()
    istio_validations = kiali_client.istio_validations(namespace=bookinfo_namespace)

    assert istio_validations != None
    assert bookinfo_namespace in istio_validations

def _test_istio_object_type(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_endpoint()

    istio_object_type = kiali_client.istio_object_type(bookinfo_namespace, OBJECT_TYPE, bookinfo_namespace)
    assert istio_object_type != None
    assert "destinationRule" in istio_object_type
    assert bookinfo_namespace in istio_object_type.get('namespace').get('name')

def _test_istio_object_istio_validations(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_endpoint()

    istio_validations = kiali_client.istio_object_istio_validations(bookinfo_namespace, OBJECT_TYPE, bookinfo_namespace)
    assert istio_validations != None
    #assert istio_validations.get('virtualservice') != None
    assert istio_validations.get('virtualservice').get(bookinfo_namespace) != None
    assert bookinfo_namespace in istio_validations.get('virtualservice').get(bookinfo_namespace).get('name')

