import tests.conftest as conftest
from utils.timeout import timeout
from utils.command_exec import command_exec
import time

def test_kiali_reduced_cluster_permissins(kiali_client):

    assert command_exec().oc_delete_kiali_permissions_from_cluster()
    with timeout(seconds=30, error_message='Timed out waiting for denial of Graph access'):
        while True:
            access = None
            try:
                kiali_client.graph_namespaces(params={'duration': '1m', 'namespaces': 'bookinfo'})
            except:
                # Will reach there if the graph is NOT accessable
                access = False

            if access == False:
                break

            time.sleep(1)

    assert command_exec().oc_add_kaili_permissions_to_cluster()
    with timeout(seconds=30, error_message='Timed out waiting for Graph access'):
        while True:
            access = True
            try:
                # Will reach there if the graph is NOT accessable
                kiali_client.graph_namespaces(params={'duration': '1m', 'namespaces': 'bookinfo'})
            except:
                access = False

            if access:
                break

            time.sleep(1)
