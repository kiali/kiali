import pytest
import tests.conftest as conftest
from utils.timeout import timeout
import time
from utils.command_exec import command_exec

PARAMS = {'graphType':'versionedApp', 'duration':'60s', 'injectServiceNodes':'false', 'edges':'trafficRatePerSecond'}
EXPECTED_EXTERNAL_SERVICE_NAME = 'external-service-foo-se'

def test_external_host_node(kiali_client):

    try:
        assert command_exec.oc_apply(conftest.EXTERNAL_HOST_SERVICE_FILE, conftest.get_bookinfo_namespace()) == True

        PARAMS['namespaces']=conftest.get_bookinfo_namespace()
        response = kiali_client.request(method_name='graphNamespaces', params=PARAMS)
        assert response.status_code == 200

        nodes = response.json().get('elements').get('nodes')

        with timeout(seconds=20, error_message='Timed out waiting for \"{}\"'.format(EXPECTED_EXTERNAL_SERVICE_NAME)):
            wiat_for = True
            while wiat_for:
                for node in nodes:
                    name = node.get('data').get('service')
                    if name != None and name == EXPECTED_EXTERNAL_SERVICE_NAME:
                        wiat_for = False
                        break

                    time.sleep(1)

    finally:
        command_exec.oc_delete(conftest.EXTERNAL_HOST_SERVICE_FILE, conftest.get_bookinfo_namespace())

