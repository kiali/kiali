@graph-side-panel
@ossmc
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Graph page - Side panel menu actions

  User opens the Graph page and uses the kebab menu to perform actions.

  Background:
    Given user is at administrator perspective

  @bookinfo-app
  Scenario: Actions in kebab menu of the side panel for a service node with existing traffic routing
    Given user graphs "bookinfo" namespaces
    And user clicks the "productpage" "service" node
    And no cluster badge for the "graph side panel" should be visible
    And user opens the kebab menu of the graph side panel
    And user clicks the "delete_traffic_routing" item of the kebab menu of the graph side panel
    Then user should see the confirmation dialog to delete all traffic routing

  @bookinfo-app
  Scenario Outline: Ability to launch <action> wizard from graph side panel
    Given user graphs "bookinfo" namespaces
    And user clicks the "reviews" "service" node
    And no cluster badge for the "graph side panel" should be visible
    And user opens the kebab menu of the graph side panel
    When user clicks the "<action>" item of the kebab menu of the graph side panel
    Then user should see the "<action>" wizard

    Examples:
      | action               |
      | traffic_shifting     |
      | tcp_traffic_shifting |
      | request_routing      |
      | fault_injection      |
      | request_timeouts     |

  @multi-cluster
  @multi-primary
  Scenario: Actions in kebab menu of the side panel for a service node with existing traffic routing
    Given user graphs "bookinfo" namespaces
    And there is traffic routing for the "ratings" service in the "bookinfo" namespace and in the "west" cluster
    And user clicks the "ratings" service node in the "bookinfo" namespace in the "west" cluster
    And the side panel links should contain a "clusterName=west" parameter
    And "west" cluster badge for the graph side panel should be visible
    And user opens the kebab menu of the graph side panel
    And user clicks the "delete_traffic_routing" item of the kebab menu of the graph side panel
    Then user should see the confirmation dialog to delete all traffic routing
    When user chooses to delete the routing
    And user is at the "istio" list page
    Then user does not see traffic routing objects for the "ratings" service in the "bookinfo" namespace in the "west" cluster

  @multi-cluster
  Scenario: Show Traces button contains clusterName param
    Given user graphs "bookinfo" namespaces
    And user clicks the "productpage" "service" node
    And "east" cluster badge for the graph side panel should be visible
    And user clicks the "Traces" graph summary tab
    Then user should see "east" cluster parameter in links in the traces

  @bookinfo-app
  @tracing
  Scenario: Traces tab contains traces
    Given user graphs "bookinfo" namespaces
    And user clicks the "productpage" "service" node
    And service badge for the graph side panel should be visible
    And user clicks the "Traces" graph summary tab
    Then user should see the traces tab not empty

  @bookinfo-app
  Scenario: Validate summary panel edge
    Given user graphs "bookinfo" namespaces
    And user clicks the edge from "productpage" "app" to "details" "service"
    And service badge for the graph side panel should be visible
    And app badge for the graph side panel should be visible
    And summary panel contains "Edge (HTTP)"
