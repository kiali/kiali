Feature: Kiali Graph page - Side panel menu actions

  User opens the Graph page and uses the kebab menu to perform actions.

  Background:
    Given user is at administrator perspective

  @graph-page-context
  Scenario: Actions in kebab menu of the side panel for a service node with existing traffic routing
    When user graphs "bookinfo" namespaces
    And user clicks the "productpage" service node
    And user opens the kebab menu of the graph side panel
    And user clicks the "delete_traffic_routing" item of the kebab menu of the graph side panel
    Then user should see the confirmation dialog to delete all traffic routing

  @graph-page-context
  Scenario Outline: Ability to launch <action> wizard from graph side panel
    When user graphs "bookinfo" namespaces
    And user clicks the "reviews" service node
    And user opens the kebab menu of the graph side panel
    And user clicks the "<action>" item of the kebab menu of the graph side panel
    Then user should see the "<action>" wizard

    Examples:
      | action                |
      | traffic_shifting      |
      | tcp_traffic_shifting  |
      | request_routing       |
      | fault_injection       |
      | request_timeouts      |
