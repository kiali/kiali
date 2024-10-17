@graph-context-menu
@cytoscape
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Graph page - Context menu actions

  User opens the Graph page and opens the context menu of graph nodes.

  Background:
    Given user is at administrator perspective
    When user graphs "bookinfo" namespaces in the cytoscape graph

  @bookinfo-app
  Scenario: Actions in context menu for service node with existing traffic routing
    And user opens the context menu of the "productpage" service node in the cytoscape graph
    And user should see no cluster parameter in the url when clicking the "Details" link in the context menu in the cytoscape graph
    And user opens the context menu of the "productpage" service node in the cytoscape graph
    And user should see no cluster parameter in the url when clicking the "Traffic" link in the context menu in the cytoscape graph
    And user opens the context menu of the "productpage" service node in the cytoscape graph
    And user should see no cluster parameter in the url when clicking the "Inbound Metrics" link in the context menu in the cytoscape graph
    And user opens the context menu of the "productpage" service node in the cytoscape graph
    And user clicks the "delete-traffic-routing" item of the context menu in the cytoscape graph
    Then user should see the confirmation dialog to delete all traffic routing

  @bookinfo-app
  Scenario Outline: Ability to launch <action> wizard from graph context menu
    And user opens the context menu of the "reviews" service node in the cytoscape graph
    And user clicks the "<action>" action of the context menu in the cytoscape graph
    Then user should see the "<action>" wizard

    Examples:
      | action               |
      | traffic_shifting     |
      | tcp_traffic_shifting |
      | request_routing      |
      | fault_injection      |
      | request_timeouts     |

  @multi-cluster
  Scenario: Actions in context menu for a service node with existing traffic routing
    And there is traffic routing for the "details" service in the "bookinfo" namespace and in the "east" cluster
    And user opens the context menu of the "details" service node on the "east" cluster in the cytoscape graph
    And user should see the "east" cluster parameter in the url when clicking the "Details" link in the context menu in the cytoscape graph
    And user opens the context menu of the "details" service node on the "east" cluster in the cytoscape graph
    And user should see the "east" cluster parameter in the url when clicking the "Traffic" link in the context menu in the cytoscape graph
    And user opens the context menu of the "details" service node on the "east" cluster in the cytoscape graph
    And user should see the "east" cluster parameter in the url when clicking the "Inbound Metrics" link in the context menu in the cytoscape graph
    And user opens the context menu of the "details" service node on the "east" cluster in the cytoscape graph
    And user clicks the "delete-traffic-routing" item of the context menu in the cytoscape graph
    Then user should see the confirmation dialog to delete all traffic routing
    When user chooses to delete the routing in the cystoscape graph
    And user is at the "istio" list page
    Then user does not see traffic routing objects for the "details" service in the "bookinfo" namespace in the "east" cluster

  @multi-cluster 
  Scenario Outline: Ability to launch <action> wizard from graph context menu for a remote service node
    And user opens the context menu of the "ratings" service node on the "west" cluster in the cytoscape graph
    And user clicks the "<action>" action of the context menu in the cytoscape graph
    Then user should see the "<action>" wizard

    Examples:
      | action               |
      | traffic_shifting     |
      | tcp_traffic_shifting |
      | request_routing      |
      | fault_injection      |
      | request_timeouts     |

  @multi-primary
  @multi-cluster 
  Scenario: Actions in context menu for a remote service node with existing traffic routing
    And there is no traffic routing for the "ratings" service in the "bookinfo" namespace and in the "west" cluster
    And there is no traffic routing for the "ratings" service in the "bookinfo" namespace and in the "east" cluster
    And user opens the context menu of the "ratings" service node on the "west" cluster in the cytoscape graph
    And user clicks the "request_routing" action of the context menu in the cytoscape graph
    Then user should see the "request_routing" wizard
    And user adds a route
    And user previews the configuration
    And user creates the configuration
    # This is a bit of a hack to ensure that traffic stays healthy on the traffic graph.
    # In multi-primary, istio configuration for cross cluster services needs to
    # be duplicated across clusters but the wizards only create the istio config
    # on a single cluster.
    And configuration is duplicated to the "east" cluster in the cytoscape graph
    And user is at the "istio" list page
    Then user sees traffic routing objects for the "ratings" service in the "bookinfo" namespace in the "west" cluster
