import pytest
import tests.conftest as conftest

# Note: Number of services +1 Views Group Node
# Note: Node and Edge counts are based on traffic origainating from the Ingress
BOOKINFO_EXPECTED_NODES=8
BOOKINFO_EXPECTED_EDGES=7
BOOKINFO_EXPECTED_SERVICES = 4

PARAMS = {'graphType':'versionedApp', 'duration':'60s', 'injectServiceNodes':'false', 'edges':'trafficRatePerSecond'}

def test_service_graph_rest_endpoint(kiali_client):

    json = get_graph_json(kiali_client)

    # Validate that there are Nodes
    assert len(json.get('elements').get('nodes')) >= 1

    # Validate that there are Edges
    assert len(json.get('elements').get('edges')) >= 1

def test_service_graph_bookinfo_namespace_(kiali_client):
    json = get_graph_json(kiali_client)

    # Validate Node count
    nodes = json.get('elements').get('nodes')
    #print ("Node count: {}".format(len(nodes)))
    assert len(nodes) >=  BOOKINFO_EXPECTED_NODES, "Expected Nodes: {}   Actual Nodes, {}".format(BOOKINFO_EXPECTED_NODES, len(nodes))

    # validate edge count
    edges = json.get('elements').get('edges')
    #print ("Edge count: {}".format(len(edges)))
    assert len(edges) >= BOOKINFO_EXPECTED_EDGES, "Expected Edges: {}   Actual Edges, {}".format(BOOKINFO_EXPECTED_EDGES, len(nodes))

def get_graph_json(kiali_client):
    PARAMS['namespaces']=conftest.get_bookinfo_namespace()
    response = kiali_client.request(method_name='graphNamespaces', params=PARAMS)
    assert response.status_code == 200

    return response.json()