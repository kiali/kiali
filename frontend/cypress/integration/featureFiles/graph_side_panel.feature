@graph-side-panel
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Graph page - Side panel menu actions

  User opens the Graph page and uses the kebab menu to perform actions.

  Background:
    Given user is at administrator perspective
    When user graphs "bookinfo" namespaces

  @bookinfo-app
  Scenario: Actions in kebab menu of the side panel for a service node with existing traffic routing
    And user clicks the "productpage" "service" node
    And no cluster badge for the "graph side panel" should be visible
    And user opens the kebab menu of the graph side panel
    And user clicks the "delete_traffic_routing" item of the kebab menu of the graph side panel
    Then user should see the confirmation dialog to delete all traffic routing

  @bookinfo-app
  Scenario Outline: Ability to launch <action> wizard from graph side panel
    And user clicks the "reviews" "service" node
    And no cluster badge for the "graph side panel" should be visible
    And user opens the kebab menu of the graph side panel
    And user clicks the "<action>" item of the kebab menu of the graph side panel
    Then user should see the "<action>" wizard

    Examples:
      | action               |
      | traffic_shifting     |
      | tcp_traffic_shifting |
      | request_routing      |
      | fault_injection      |
      | request_timeouts     |

  @skip
  @multi-cluster
  Scenario: Actions in kebab menu of the side panel for a service node with existing traffic routing
    And there is a traffic routing for the "reviews" service present
    And user clicks the "reviews" service node
    And the side panel links should contain a parameter related to cluster name
    And "west" cluster badge for the "graph side panel" should be visible
    And user opens the kebab menu of the graph side panel
    And user clicks the "delete_traffic_routing" item of the kebab menu of the graph side panel
    Then user should see the confirmation dialog to delete all traffic routing
    And when user chooses to delete the routing
    And user is at the "istio" list page
    Then no traffic routing for "reviews" should be located in the west cluster

  @skip
  @multi-cluster
  Scenario Outline: Ability to launch <action> wizard from graph side panel
    And user clicks the "ratings" service node
    And user opens the kebab menu of the graph side panel
    And user clicks the "<action>" item of the kebab menu of the graph side panel
    Then user should see the "<action>" wizard

    Examples:
      | action               |
      | traffic_shifting     |
      | tcp_traffic_shifting |
      | request_routing      |
      | fault_injection      |
      | request_timeouts     |

  @skip
  @remote-istio-crds
  @multi-cluster
  Scenario: Actions in context menu for a remote service node with existing traffic routing
    And there is no traffic routing for the "ratings" service present
    And user opens the context menu of the "ratings" service node
    And user clicks the "request_routing" action of the context menu
    Then user should see the "request_routing" wizard
    And user previews the configuration
    And user creates the configuration
    And user is at the "istio" list page
    Then a traffic routing for "ratings" should be located in the west cluster

  @skip
  @bookinfo-app
  @multi-cluster
  @tracing
  Scenario: Show Traces button contains clusterName param
    And user clicks the "productpage" "service" node
    And cluster badge for the "graph side panel" should be visible
    And user clicks the "Traces" graph summary tab
    Then user should see "" cluster parameter in links in the traces

  @bookinfo-app
  @tracing
  Scenario: Traces tab contains traces
    And user clicks the "productpage" "service" node
    And service badge for the graph side panel should be visible
    And user clicks the "Traces" graph summary tab
    Then user should see the traces tab not empty
