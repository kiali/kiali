@graph-page-find-hide
@ossmc
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Graph page - Find/Hide

  User opens the Graph page and manipulates the "error-rates" demo.
  The find/hide feature lets the user either highlight or hide nodes
  on the graph that match the query expression. Some preset queries
  allow the user to easily get started using find/hide and a help
  section describes in more detail how to use find/hide.

  Background:
    Given user is at administrator perspective
    And user graphs "alpha,beta" namespaces

  @error-rates-app
  Scenario: Find unhealthy workloads
    Then user sees nothing highlighted on the graph
    When user finds unhealthy workloads
    Then user sees unhealthy workloads highlighted on the graph

  @error-rates-app
  Scenario: Hide unhealthy workloads
    When user hides unhealthy workloads
    Then user sees no unhealthy workloads on the graph

  @error-rates-app
  Scenario: Use preset find option to filter workloads
    Then user sees preset find options
    When user selects the preset the find option "Find: unhealthy nodes"
    Then user sees unhealthy workloads highlighted on the graph

  @error-rates-app
  Scenario: Use preset hide option to filter workloads
    Then user sees preset hide options
    When user selects the preset hide option "Hide: healthy nodes"
    Then user sees no healthy workloads on the graph

  @error-rates-app
  Scenario: Show Graph Find/Hide help menu
    When user seeks help for find and hide
    Then user sees the help menu
    And the help menu has info on "Examples"
    And the help menu has info on "Nodes"
    And the help menu has info on "Edges"
    And the help menu has info on "Operators"
    And the help menu has info on "Usage Notes"

  @error-rates-app
  Scenario: Filling the find form with nonsense
    When user fills "hello world" in find and submits
    Then user sees the "Find: No valid operator found in expression" message
