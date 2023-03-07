Feature: Kiali Graph page - Context menu actions

  User opens the Graph page and opens the context menu of graph nodes.

  Background:
    Given user is at administrator perspective

  @graph-page-context
  Scenario: Actions in context menu for service node with existing traffic routing
    When user graphs "bookinfo" namespaces
    And user opens the context menu of the "productpage" service node
    And user clicks the "delete-traffic-routing" item of the context menu
    Then user should see the confirmation dialog to delete all traffic routing

  @graph-page-context
  Scenario Outline: Ability to launch <action> wizard from graph context menu
    When user graphs "bookinfo" namespaces
    And user opens the context menu of the "reviews" service node
    And user clicks the "<action>" action of the context menu
    Then user should see the "<action>" wizard

    Examples:
      | action                |
      | traffic_shifting      |
      | tcp_traffic_shifting  |
      | request_routing       |
      | fault_injection       |
      | request_timeouts      |
