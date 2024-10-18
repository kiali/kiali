@graph-toolbar-legend
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Graph page - Graph toolbar and legend sidebar

  User opens the Graph page and manipulates the "alpha", "beta" namespace graph with buttons
  located at the bottom of the page

  Background:
    Given user is at administrator perspective
    And user graphs "alpha,beta" namespaces

  @error-rates-app
  Scenario Outline: Check if the <id> button is usable
    Then the toggle button "<id>" is enabled
    Examples:
      | id                           |
      | reset-view                   |
      | toolbar_edge_mode_unhealthy  |
      | toolbar_edge_mode_none       |
      | toolbar_layout_dagre         |
      | toolbar_layout_grid          |
      | toolbar_layout_concentric    |
      | toolbar_layout_breadth_first |
      | legend                       |

  @error-rates-app
  Scenario Outline: Check if the not active by default <id> Graph button can be turned on
    When the button "<id>" is clicked
    Then the button "<id>" is active
    Examples:
      | id                           |
      | toolbar_edge_mode_unhealthy  |
      | toolbar_edge_mode_none       |
      | toolbar_layout_dagre         |
      | toolbar_layout_grid          |
      | toolbar_layout_concentric    |
      | toolbar_layout_breadth_first |
      | legend                       |

  @error-rates-app
  Scenario Outline: Check if the not active by default <label> Graph button can be turned off
    When the "<id>" is turned on
    And the button "<id>" is clicked
    Then the button "<id>" is not active
    Examples:
      | id                          |
      | toolbar_edge_mode_unhealthy |
      | toolbar_edge_mode_none      |

  @error-rates-app
  Scenario: The Hide Healthy Edges is turned off by turning on the Hide All Edges
    When the "toolbar_edge_mode_unhealthy" is turned off
    And the "toolbar_edge_mode_none" is turned off
    And the button "toolbar_edge_mode_unhealthy" is clicked
    And the button "toolbar_edge_mode_none" is clicked
    Then the button "toolbar_edge_mode_unhealthy" is not active
    And the button "toolbar_edge_mode_none" is active

  @error-rates-app
  Scenario: The Hide All Edges is turned off by turning on the Hide Healthy Edges
    When the "toolbar_edge_mode_unhealthy" is turned off
    And the "toolbar_edge_mode_none" is turned off
    And the button "toolbar_edge_mode_none" is clicked
    And the button "toolbar_edge_mode_unhealthy" is clicked
    Then the button "toolbar_edge_mode_unhealthy" is active
    And the button "toolbar_edge_mode_none" is not active

  @error-rates-app
  Scenario: Graph Layout Style buttons are mutually exclusive
    When the "toolbar_layout_dagre" is turned on
    And the "toolbar_layout_grid" is turned off
    And the "toolbar_layout_concentric" is turned off
    And the "toolbar_layout_breadth_first" is turned off
    And the button "toolbar_layout_grid" is clicked
    And the button "toolbar_layout_concentric" is clicked
    And the button "toolbar_layout_breadth_first" is clicked
    Then the button "toolbar_layout_dagre" is not active
    And the button "toolbar_layout_grid" is not active
    And the button "toolbar_layout_concentric" is not active
    And the button "toolbar_layout_breadth_first" is active

  @error-rates-app
  Scenario: Show the Legend
    When the button "legend" is clicked
    Then user can see the legend section
    And the button "legend" is active

  @error-rates-app
  Scenario: Close the Legend using the button
    When the Legend section is visible
    And the button "legend" is clicked
    Then user cannot see the legend section
    And the button "legend" is not active

  @error-rates-app
  Scenario: Close the Legend using the cross
    When the Legend section is visible
    And the cross is clicked
    Then user cannot see the legend section
    And the button "legend" is not active
