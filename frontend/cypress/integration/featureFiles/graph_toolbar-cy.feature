@graph-toolbar
@cytoscape
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Graph page - Toolbar (various)

  User opens the Graph page and manipulates the "error-rates" demo via Toolbar.

  Background:
    Given user is at administrator perspective

  # NOTE: Graph Display menu has its own test script
  #       - tests empty graph as well
  # NOTE: Graph Find/Hide has its own test script
  # NOTE: Graph Replay has its own test script

  Scenario: On the graph page the namespace selector should be sorted alphabetically
    When user graphs "" namespaces in the cytoscape graph
    Then the namespace dropdown is sorted alphabetically

  @error-rates-app
  Scenario: Graph alpha namespace with query params in the cytoscape graph
    When user graphs "alpha" namespaces with refresh "900000" and duration "300" in the cytoscape graph
    Then user sees the "alpha" namespace
    And user sees selected graph duration "Last 5m"
    And user sees selected graph refresh "Every 15m"

  @error-rates-app
  Scenario: Open graph Tour
    When user clicks graph tour
    Then user "sees" graph tour

  @error-rates-app
  Scenario: Close graph Tour
    When user closes graph tour
    Then user "does not see" graph tour

  @error-rates-app
  Scenario: Open traffic dropdown
    When user clicks graph traffic menu
    Then user sees "default" graph traffic menu

  @error-rates-app
  Scenario: Disable all traffic
    When user disables all traffic
    Then user does not see any traffic

  # todo: would be a better test if demos has tcp and/or grpc traffic
  @error-rates-app
  Scenario: Enable http traffic
    When user disables all traffic
    When user enables "http" traffic
    Then user "sees" "http" traffic in the cytoscape graph
    And user "does not see" "tcp" traffic in the cytoscape graph
    And user "does not see" "grpc" traffic in the cytoscape graph

  @error-rates-app
  Scenario: Close traffic dropdown
    When user clicks graph traffic menu
    Then user does not see graph traffic menu

  @error-rates-app
  @graph-page-display
  Scenario: User resets to factory default
    When user resets to factory default
    And user clicks graph traffic menu
    Then user sees "default" graph traffic menu

  @error-rates-app
  Scenario: Open duration dropdown
    When user clicks graph duration menu
    Then user sees graph duration menu

  @error-rates-app
  Scenario: Close duration dropdown
    When user clicks graph duration menu
    Then user does not see graph duration menu

  @error-rates-app
  Scenario: Set duration dropdown
    When user selects graph duration "600"
    Then user sees selected graph duration "Last 10m"

  @error-rates-app
  Scenario: Open refresh dropdown
    When user clicks graph refresh menu
    Then user sees graph refresh menu

  @error-rates-app
  Scenario: Close refresh dropdown
    When user clicks graph refresh menu
    Then user does not see graph refresh menu

  @error-rates-app
  Scenario: Set refresh dropdown
    When user selects graph refresh "0"
    Then user sees selected graph refresh "Pause"

  @error-rates-app
  Scenario: graph type app
    When user selects "APP" graph type
    Then user sees a "app" cytoscape graph

  @error-rates-app
  Scenario: graph type service
    When user selects "SERVICE" graph type
    Then user sees a "service" cytoscape graph

  @error-rates-app
  Scenario: graph type versioned app
    When user selects "VERSIONED_APP" graph type
    Then user sees a "versionedApp" cytoscape graph

  @error-rates-app
  Scenario: graph type workload
    When user selects "WORKLOAD" graph type
    Then user sees a "workload" cytoscape graph

  @ambient
  Scenario: Open traffic dropdown for ambient
    When user graphs "" namespaces in the cytoscape graph
    And user clicks graph traffic menu
    Then user sees "ambient" graph traffic menu

  @ambient
  Scenario: Close traffic dropdown for ambient
    When user clicks graph traffic menu
    Then user does not see graph traffic menu

