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
    And user is at the "overview" page

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

  @error-rates-app
  @overview-page
  Scenario: Last 10 minutes
    When user selects "Last 10m" time range
    Then user sees the "alpha" namespace with "inbound" traffic "10m"

  @error-rates-app
  @overview-page
  Scenario: Last 10 minutes Outbound traffic
    When user selects "Last 10m" time range
    And user selects "Outbound" traffic direction
    Then user sees the "alpha" namespace with "outbound" traffic "10m"

  @error-rates-app
  @overview-page
  @bookinfo-app
  Scenario: The healthy status of a logical mesh application is reported in the overview of a namespace
    Given a healthy application in the cluster
    When I fetch the overview of the cluster
    Then there should be a "healthy" application indicator in the namespace
    And the "healthy" application indicator should list the application

  @error-rates-app
  @overview-page
  Scenario: The idle status of a logical mesh application is reported in the overview of a namespace
    Given an idle application in the cluster
    When I fetch the overview of the cluster
    Then there should be a "idle" application indicator in the namespace
    And the "idle" application indicator should list the application

  @error-rates-app
  @overview-page
  Scenario: The failing status of a logical mesh application is reported in the overview of a namespace
    Given a failing application in the mesh
    When I fetch the overview of the cluster
    Then there should be a "failure" application indicator in the namespace
    And the "failure" application indicator should list the application

  @error-rates-app
  @overview-page
  Scenario: The degraded status of a logical mesh application is reported in the overview of a namespace
    Given a degraded application in the mesh
    When I fetch the overview of the cluster
    Then there should be a "degraded" application indicator in the namespace
    And the "degraded" application indicator should list the application

  @error-rates-app
  @overview-page
  Scenario: The minimum TLS version is visible in the control plane
    When user hovers over the MinTLS locker
    Then the user sees the certificates information
    And the minimum TLS version

  @error-rates-app
  @overview-page
  Scenario: The canary upgrade information is not present when there is no canary configured
    Then the user sees no information related to canary upgrades

  @error-rates-app
  @overview-page
  Scenario: The Istio panel should be visible in the control panel
    Then user sees the "istio-system" namespace card
    And user sees the "Control plane" label in the "istio-system" namespace card
    And user sees the "Outbound policy" label in the "istio-system" namespace card
    Then the toggle on the right side of the "istio-system" namespace card exists

  @overview-page
  Scenario: The control plane metrics should be present
    Then user sees the memory chart
    And user sees the cpu chart

  @overview-page
  @multi-cluster
  Scenario: See "bookinfo" in "east" and "west" clusters
    Then user sees the "bookinfo" namespace card in cluster "east"
    And user sees the "bookinfo" namespace card in cluster "west"
