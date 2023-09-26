@graph-context-menu
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Graph page - Context menu actions

  User opens the Graph page and opens the context menu of graph nodes.

  Background:
    Given user is at administrator perspective
    When user graphs "bookinfo" namespaces

  @bookinfo-app
  Scenario: Actions in context menu for service node with existing traffic routing
    And user opens the context menu of the "productpage" service node
    And user should see "no" cluster parameter in links in the context menu
    And user clicks the "delete-traffic-routing" item of the context menu
    Then user should see the confirmation dialog to delete all traffic routing

  @bookinfo-app
  Scenario Outline: Ability to launch <action> wizard from graph context menu
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
    And there is a traffic routing for the "reviews" service present
    And user opens the context menu of the "reviews" service node
    And user should see "" cluster parameter in links in the context menu
    And user clicks the "delete-traffic-routing" item of the context menu
    Then user should see the confirmation dialog to delete all traffic routing
    And when user chooses to delete the routing
    And user is at the "istio" list page
    Then no traffic routing for "reviews" should be located in the west cluster

  @skip
  @multi-cluster 
  Scenario Outline: Ability to launch <action> wizard from graph context menu for a remote service node
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
