@graph-context-menu
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Graph page - Context menu actions

  User opens the Graph page and opens the context menu of graph nodes.

  Background:
    Given user is at administrator perspective

  @bookinfo-app
  Scenario: Actions in context menu for service node with existing traffic routing
    When user graphs "bookinfo" namespaces
    And user opens the context menu of the "productpage" service node
    And user should see "no" cluster parameter in links in the context menu
    And user clicks the "delete-traffic-routing" item of the context menu
    Then user should see the confirmation dialog to delete all traffic routing

  @bookinfo-app
  Scenario Outline: Ability to launch <action> wizard from graph context menu
    When user graphs "bookinfo" namespaces
    And user opens the context menu of the "reviews" service node
    And user clicks the "<action>" action of the context menu
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
  Scenario: Actions in context menu for a remote service node with existing traffic routing
    When user graphs "bookinfo" namespaces
    And there is a traffic routing for the "reviews" service present
    And user opens the context menu of the "reviews" service node
    And user clicks the "delete-traffic-routing" item of the context menu
    Then user should see the confirmation dialog to delete all traffic routing

  @skip
  @multi-cluster 
  Scenario Outline: Ability to launch <action> wizard from graph context menu for a remote service node
    When user graphs "bookinfo" namespaces
    And user opens the context menu of the "ratings" service node
    And user clicks the "<action>" action of the context menu
    Then user should see the "<action>" wizard

    Examples:
      | action               |
      | traffic_shifting     |
      | tcp_traffic_shifting |
      | request_routing      |
      | fault_injection      |
      | request_timeouts     |
