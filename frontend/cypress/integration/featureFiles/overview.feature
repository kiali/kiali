Feature: Kiali Overview page

  User opens the Overview page and see the demo "error-rates" namespaces.

  Health indicators in overview page
    Kiali is capable of calculating the health of services in the mesh/cluster
    using several data sources like workload availability and errors in traffic.
    Kiali offers health status at different levels of granularity: from namespace
    level, to the individual pod. In the overview page, health indicators have
    namespace level and app level granularity.

  Background:
    Given user is at administrator perspective
    And user opens the overview page

  @overview-page
  Scenario: See "alpha" and "beta" namespaces
    Then user sees the "alpha" namespace card
    And user sees the "beta" namespace card

  @overview-page
  Scenario: Doesn't see a "bad" namespace
    Then user doesn't see the "bad" namespace card

  @overview-page
  Scenario: Select the COMPACT view
    When user clicks in the "COMPACT" view
    Then user sees a "COMPACT" "alpha" namespace

  @overview-page
  Scenario: Select the EXPAND view
    When user clicks in the "EXPAND" view
    Then user sees a "EXPAND" "beta" namespace

  @overview-page
  Scenario: Select the LIST view
    When user clicks in the "LIST" view
    Then user sees a "LIST" "beta" namespace

  @overview-page
  Scenario: Filter by namespace
    When user filters "alpha" namespace
    Then user sees the "alpha" namespace card
    And user doesn't see the "beta" namespace card

  @overview-page
  Scenario: Filter by health
    When user filters "Failure" health
    Then user sees the "alpha" namespace card
    And user sees the "beta" namespace card
    And user doesn't see the "default" namespace card

  @overview-page
  Scenario: Sort by name
    When user filters "alpha" namespace
    And user filters "beta" namespace
    And user sorts by name desc
    Then user sees the "beta,alpha" namespace list

  @overview-page
  Scenario: Health for Apps
    When user selects Health for "Apps"
    Then user sees the "alpha" namespace with "Applications"

  @overview-page
  Scenario: Health for Workloads
    When user selects Health for "Workloads"
    Then user sees the "alpha" namespace with "Workloads"

  @overview-page
  Scenario: Health for Services
    When user selects Health for "Services"
    Then user sees the "alpha" namespace with "Services"

  @overview-page
  Scenario: Last 10 minutes
    When user selects "Last 10m" time range
    Then user sees the "alpha" namespace with "inbound" traffic "10m"

  @overview-page
  Scenario: Last 10 minutes Outbound traffic
    When user selects "Last 10m" time range
    And user selects "Outbound" traffic direction
    Then user sees the "alpha" namespace with "outbound" traffic "10m"

  @overview-page
  Scenario: The healthy status of a logical mesh application is reported in the overview of a namespace
    Given a healthy application in the cluster
    When I fetch the overview of the cluster
    Then there should be a "healthy" application indicator in the namespace
    And the "healthy" application indicator should list the application

  @overview-page
  Scenario: The idle status of a logical mesh application is reported in the overview of a namespace
    Given an idle application in the cluster
    When I fetch the overview of the cluster
    Then there should be a "idle" application indicator in the namespace
    And the "idle" application indicator should list the application

  @overview-page
  Scenario: The failing status of a logical mesh application is reported in the overview of a namespace
    Given a failing application in the mesh
    When I fetch the overview of the cluster
    Then there should be a "failure" application indicator in the namespace
    And the "failure" application indicator should list the application

  @overview-page
  Scenario: The degraded status of a logical mesh application is reported in the overview of a namespace
    Given a degraded application in the mesh
    When I fetch the overview of the cluster
    Then there should be a "degraded" application indicator in the namespace
    And the "degraded" application indicator should list the application
