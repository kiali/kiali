@graph-toolbar-legend
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Graph page - Graph toolbar and legend sidebar

  User opens the Graph page and manipulates the "alpha", "beta" namespace graph with buttons
  located at the bottom of the page

  Background:
    Given user is at administrator perspective
    And user graphs "alpha,beta" namespaces in the cytoscape graph

  @error-rates-app
  Scenario Outline: Check if the <label> button is usable
    Then the toggle button "<label>" is enabled
    Examples:
      | label                      |
      | Toggle Drag                |
      | Zoom to Fit                |
      | Hide Healthy Edges         |
      | Hide All Edges             |
      | Graph Layout Default Style |
      | Graph Layout Style 1       |
      | Graph Layout Style 2       |
      | Graph Layout Style 3       |
      | Namespace Layout Style 1   |
      | Namespace Layout Style 2   |
      | Show Legend                |

  @error-rates-app
  Scenario: Check if the Toggle Drag Graph button can be turned off
    When the button "Toggle Drag" is clicked
    Then the button "Toggle Drag" is not active

  @error-rates-app
  Scenario: Check if the Toggle Drag Graph button can be turned on
    When the "Toggle Drag" is turned off
    And the button "Toggle Drag" is clicked
    Then the button "Toggle Drag" is active

  @error-rates-app
  Scenario Outline: Check if the not active by default <label> Graph button can be turned on
    When the button "<label>" is clicked
    Then the button "<label>" is active
    Examples:
      | label                    |
      | Hide Healthy Edges       |
      | Hide All Edges           |
      | Graph Layout Style 1     |
      | Graph Layout Style 2     |
      | Graph Layout Style 3     |
      | Namespace Layout Style 2 |

  @error-rates-app
  Scenario Outline: Check if the not active by default <label> Graph button can be turned off
    When the "<label>" is turned on
    And the button "<label>" is clicked
    Then the button "<label>" is not active
    Examples:
      | label              |
      | Hide Healthy Edges |
      | Hide All Edges     |

  @error-rates-app
  Scenario: The Hide Healthy Edges is turned off by turning on the Hide All Edges
    When the "Hide Healthy Edges" is turned off
    And the "Hide All Edges" is turned off
    And the button "Hide Healthy Edges" is clicked
    And the button "Hide All Edges" is clicked
    Then the button "Hide Healthy Edges" is not active
    And the button "Hide All Edges" is active

  @error-rates-app
  Scenario: The Hide All Edges is turned off by turning on the Hide Healthy Edges
    When the "Hide Healthy Edges" is turned off
    And the "Hide All Edges" is turned off
    And the button "Hide All Edges" is clicked
    And the button "Hide Healthy Edges" is clicked
    Then the button "Hide Healthy Edges" is active
    And the button "Hide All Edges" is not active

  @error-rates-app
  Scenario: The Namespace Layout Style 1 is turned off by turning on the Namespace Layout Style 2
    When the "Namespace Layout Style 1" is turned off
    And the "Namespace Layout Style 2" is turned off
    And the button "Namespace Layout Style 1" is clicked
    And the button "Namespace Layout Style 2" is clicked
    Then the button "Namespace Layout Style 1" is not active
    And the button "Namespace Layout Style 2" is active

  @error-rates-app
  Scenario: The Namespace Layout Style 2 is turned off by turning on the Namespace Layout Style 1
    When the "Namespace Layout Style 1" is turned off
    And the "Namespace Layout Style 2" is turned off
    And the button "Namespace Layout Style 2" is clicked
    And the button "Namespace Layout Style 1" is clicked
    Then the button "Namespace Layout Style 1" is active
    And the button "Namespace Layout Style 2" is not active

  @error-rates-app
  Scenario: First 3 Graph Layout Style buttons are mutually exclusive
    When the "Graph Layout Default Style" is turned on
    And the "Graph Layout Style 1" is turned off
    And the "Graph Layout Style 2" is turned off
    And the "Graph Layout Style 3" is turned off
    And the button "Graph Layout Style 1" is clicked
    And the button "Graph Layout Style 2" is clicked
    And the button "Graph Layout Style 3" is clicked
    Then the button "Graph Layout Default Style" is not active
    And the button "Graph Layout Style 1" is not active
    And the button "Graph Layout Style 2" is not active
    And the button "Graph Layout Style 3" is active

  @error-rates-app
  Scenario: The last Graph Layout Style button is mutually exclusive with the rest
    When the "Graph Layout Default Style" is turned off
    And the "Graph Layout Style 1" is turned off
    And the "Graph Layout Style 2" is turned off
    And the "Graph Layout Style 3" is turned on
    And the button "Graph Layout Style 2" is clicked
    And the button "Graph Layout Style 1" is clicked
    And the button "Graph Layout Default Style" is clicked
    Then the button "Graph Layout Default Style" is active
    And the button "Graph Layout Style 1" is not active
    And the button "Graph Layout Style 2" is not active
    And the button "Graph Layout Style 3" is not active

  @error-rates-app
  Scenario: Show the Legend
    When the button "Show Legend" is clicked
    Then user can see the legend section
    And the button "Show Legend" is active

  @error-rates-app
  Scenario: Close the Legend using the button
    When the Legend section is visible
    And the button "Show Legend" is clicked
    Then user cannot see the legend section
    And the button "Show Legend" is not active

  @error-rates-app
  Scenario: Close the Legend using the cross
    When the Legend section is visible
    And the cross is clicked
    Then user cannot see the legend section
    And the button "Show Legend" is not active
