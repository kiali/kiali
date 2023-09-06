@graph-side-panel
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Graph page - Side panel menu actions

  User opens the Graph page and uses the kebab menu to perform actions.

  Background:
    Given user is at administrator perspective

  @bookinfo-app
  Scenario: Actions in kebab menu of the side panel for a service node with existing traffic routing
    When user graphs "bookinfo" namespaces
    And user clicks the "productpage" service node
    And no cluster badge for the "graph side panel" should be visible
    And user opens the kebab menu of the graph side panel
    And user clicks the "delete_traffic_routing" item of the kebab menu of the graph side panel
    Then user should see the confirmation dialog to delete all traffic routing

  @bookinfo-app
  Scenario Outline: Ability to launch <action> wizard from graph side panel
    When user graphs "bookinfo" namespaces
    And user clicks the "reviews" service node
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
    When user graphs "bookinfo" namespaces
    And there is a traffic routing for the "reviews" service present
    And user clicks the "reviews" service node
    And the side panel links should contain a parameter related to cluster name
    And user opens the kebab menu of the graph side panel
    And user clicks the "delete_traffic_routing" item of the kebab menu of the graph side panel
    Then user should see the confirmation dialog to delete all traffic routing

  @skip
  @multi-cluster
  Scenario Outline: Ability to launch <action> wizard from graph side panel
    When user graphs "bookinfo" namespaces
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
