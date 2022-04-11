import pytest
import tests.conftest as conftest

OBJECT_TYPE = 'virtualservices'
OBJECT_TYPE_SINGLE = 'virtualservice'
bookinfo_namespace = conftest.get_bookinfo_namespace()


def test_istio_permissions_namespaces(kiali_client):
    
    istio_namespace = kiali_client.request(method_name='getPermissions', params={'namespaces': bookinfo_namespace}).json()
    
    assert istio_namespace != None
    assert "bookinfo" in istio_namespace
    assert istio_namespace.get('bookinfo') != None
    gateway = istio_namespace.get('bookinfo').get('authorizationpolicies')
    assert gateway != None

