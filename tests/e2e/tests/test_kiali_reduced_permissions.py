import tests.conftest as conftest
from utils.timeout import timeout
from utils.command_exec import command_exec
import time

PARAMS = {'graphType':'versionedApp', 'duration':'60s', 'injectServiceNodes':'false', 'edges':'trafficRatePerSecond'}

def _test_kiali_reduced_cluster_permissions(kiali_client):
    bookinfo_namespace = conftest.get_bookinfo_namespace()

    try:
        assert command_exec().oc_remove_cluster_role_rom_user_kiali()
        with timeout(seconds=60, error_message='Timed out waiting for denial of Graph access'):
            while True:
                text = get_graph_json(kiali_client, bookinfo_namespace)
                if "is not accessible" in text:
                    break

                time.sleep(1)
    finally:
        assert command_exec().oc_add_cluster_role_to_user_kiali()
        with timeout(seconds=60, error_message='Timed out waiting for Graph access'):
            while True:
                text = get_graph_json(kiali_client, bookinfo_namespace)
                if "is not accessible" not in text and bookinfo_namespace in text:
                    break

                time.sleep(1)

def get_graph_json(kiali_client, bookinfo_namespace):
    PARAMS['namespaces'] = bookinfo_namespace
    return kiali_client.request(method_name='graphNamespaces', params=PARAMS).text
