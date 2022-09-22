Feature: Kiali Graph page - Toolbar (various)

  User opens the Graph page and manipulates the "error-rates" demo via Toolbar.

  Background:
    Given user is at administrator perspective

# NOTE: Graph Display menu has its own test script
#       - tests empty graph as well
# NOTE: Graph Find/Hide has its own test script
# NOTE: Graph Replay has its own test script

@graph-page-toolbar
Scenario Outline: Graph alpha namespace with query params
  When user graphs "alpha" namespaces with refresh "<refresh_param>" and duration "<duration_param>"
  Then user sees the "alpha" namespace
  And user sees selected graph refresh "<displayed_refresh>"
  And user sees selected graph duration "<displayed_duration>"
  Examples:
      | refresh_param | duration_param | displayed_refresh | displayed_duration |
      | 0             | 60             | Pause             | Last 1m            |
      | 10000         | 120            | Every 10s         | Last 2m            |
      | 15000         | 300            | Every 15s         | Last 5m            |
      | 30000         | 600            | Every 30s         | Last 10m           |
      | 60000         | 1800           | Every 1m          | Last 30m           |
      | 300000        | 3600           | Every 5m          | Last 1h            |
      | 900000        | 10800          | Every 15m         | Last 3h            |
      | 900000        | 21600          | Every 15m         | Last 6h            |
      | 900000        | 43200          | Every 15m         | Last 12h           |
      | 900000        | 86400          | Every 15m         | Last 1d            |
      | 900000        | 604800         | Every 15m         | Last 7d            |

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
