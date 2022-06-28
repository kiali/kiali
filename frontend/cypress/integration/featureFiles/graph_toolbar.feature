Feature: Kiali Graph page - Toolbar (various)

  User opens the Graph page and manipulates the "error-rates" demo via Toolbar.

  Background:
    Given user is at administrator perspective

# NOTE: Graph Display menu has its own test script
#       - tests empty graph as well
# NOTE: Graph Find/Hide has its own test script
# NOTE: Graph Replay has its own test script

@graph-page-toolbar
Scenario: Graph alpha namespace with query params
  When user graphs "alpha" namespaces with refresh "900000" and duration "300"
  Then user sees the "alpha" namespace
  And user sees selected graph duration "Last 5m"
  And user sees selected graph refresh "Every 15m"

@graph-page-toolbar
Scenario: Open graph Tour
  When user clicks graph tour
  Then user "sees" graph tour

@graph-page-toolbar
Scenario: Close graph Tour
  When user closes graph tour
  Then user "does not see" graph tour

@graph-page-toolbar
Scenario: Open traffic dropdown
  When user clicks graph traffic menu
  Then user sees default graph traffic menu

@graph-page-toolbar
Scenario: Disable all traffic
  When user disables all traffic
  Then user does not see any traffic

# todo: would be a better test if demos has tcp and/or grpc traffic
@graph-page-toolbar
Scenario: Enable http traffic
  When user enables "http" traffic
  Then user "sees" "http" traffic
  And user "does not see" "tcp" traffic
  And user "does not see" "grpc" traffic

@graph-page-toolbar
Scenario: Close traffic dropdown
  When user clicks graph traffic menu
  Then user does not see graph traffic menu

@graph-page-display
Scenario: User resets to factory default
  When user resets to factory default
  And user clicks graph traffic menu
  Then user sees default graph traffic menu

@graph-page-toolbar
Scenario: Open duration dropdown
  When user clicks graph duration menu
  Then user sees graph duration menu

@graph-page-toolbar
Scenario: Close duration dropdown
  When user clicks graph duration menu
  Then user does not see graph duration menu

@graph-page-toolbar
Scenario: Set duration dropdown
  When user selects graph duration "600"
  Then user sees selected graph duration "Last 10m"

@graph-page-toolbar
Scenario: Open refresh dropdown
  When user clicks graph refresh menu
  Then user sees graph refresh menu

@graph-page-toolbar
Scenario: Close refresh dropdown
  When user clicks graph refresh menu
  Then user does not see graph refresh menu

@graph-page-toolbar
Scenario: Set refresh dropdown
  When user selects graph refresh "0"
  Then user sees selected graph refresh "Pause"

@graph-page-toolbar
Scenario: graph type app
  When user selects "APP" graph type
  Then user sees a "app" graph

@graph-page-toolbar
Scenario: graph type service
  When user selects "SERVICE" graph type
  Then user sees a "service" graph

@graph-page-toolbar
Scenario: graph type versioned app
  When user selects "VERSIONED_APP" graph type
  Then user sees a "versionedApp" graph

@graph-page-toolbar
Scenario: graph type service
  When user selects "WORKLOAD" graph type
  Then user sees a "workload" graph
