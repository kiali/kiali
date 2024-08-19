@overview
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

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

  Scenario: See "alpha" and "beta" namespaces
    Then user sees the "alpha" namespace card
    And user does not see any cluster badge in the "alpha" namespace card
    And user sees the "beta" namespace card
    And user does not see any cluster badge in the "beta" namespace card

  Scenario: Doesn't see a "bad" namespace
    Then user doesn't see the "bad" namespace card

  Scenario: Select the COMPACT view
    When user clicks in the "COMPACT" view
    Then user sees a "COMPACT" "alpha" namespace

  Scenario: Select the EXPAND view
    When user clicks in the "EXPAND" view
    Then user sees a "EXPAND" "beta" namespace

  Scenario: Select the LIST view
    When user clicks in the "LIST" view
    Then user sees a "LIST" "beta" namespace
    And the "Cluster" column "disappears"

  Scenario: Filter by namespace
    When user filters "alpha" namespace
    Then user sees the "alpha" namespace card
    And user doesn't see the "beta" namespace card

  Scenario: Sort by name
    When user filters "alpha" namespace
    And user filters "beta" namespace
    And user sorts by name desc
    Then user sees the "beta,alpha" namespace list

  Scenario: Health for Apps
    When user selects Health for "Apps"
    Then user sees the "alpha" namespace with "Applications"

  Scenario: Health for Workloads
    When user selects Health for "Workloads"
    Then user sees the "alpha" namespace with "Workloads"

  Scenario: Health for Services
    When user selects Health for "Services"
    Then user sees the "alpha" namespace with "Services"

  @error-rates-app
  Scenario: Last 10 minutes
    When user selects "Last 10m" time range
    Then user sees the "alpha" namespace with "inbound" traffic "10m"

  @error-rates-app
  Scenario: Last 10 minutes Outbound traffic
    When user selects "Last 10m" time range
    And user selects "Outbound" traffic direction
    Then user sees the "alpha" namespace with "outbound" traffic "10m"
  
  @error-rates-app
  @bookinfo-app
  Scenario: The healthy status of a logical mesh application is reported in the overview of a namespace
    Given a healthy application in the cluster
    When I fetch the overview of the cluster
    Then there should be a "healthy" application indicator in the namespace
    And the "healthy" application indicator should list the application

  @sleep-app
  @error-rates-app
  @sleep-app-scaleup-after
  Scenario: The idle status of a logical mesh application is reported in the overview of a namespace
    Given an idle sleep application in the cluster
    When I fetch the overview of the cluster
    Then there should be a "idle" application indicator in the namespace
    And the "idle" application indicator should list the application

  @error-rates-app
  Scenario: The failing status of a logical mesh application is reported in the overview of a namespace
    Given a failing application in the mesh
    When I fetch the overview of the cluster
    Then there should be a "failure" application indicator in the namespace
    And the "failure" application indicator should list the application

  @error-rates-app
  @skip-lpinterop
  Scenario: The degraded status of a logical mesh application is reported in the overview of a namespace
    Given a degraded application in the mesh
    When I fetch the overview of the cluster
    Then there should be a "degraded" application indicator in the namespace
    And the "degraded" application indicator should list the application

  @error-rates-app
  Scenario: The Istio panel should be visible in the control panel
    Then user sees the "istio-system" namespace card
    And user does not see any cluster badge in the "istio-system" namespace card
    And user sees the "Control plane" label in the "istio-system" namespace card

  @multi-cluster
  Scenario: The badge for local cluster should be visible
    Then user sees the "east" cluster badge in the Kiali header

  @multi-cluster
  Scenario: Istio panels for both clusters should be visible and have the control panel label
    Then user sees the "istio-system" namespace card in cluster "east"
    And user sees the "istio-system" namespace card in cluster "west"
    And user sees the "Control plane" label in both "istio-system" namespace cards
    And user sees the "Remote Cluster" label in the "west" "istio-system" namespace card
    And the toggle on the right side of both "istio-system" namespace cards exists
    And Istio config should not be available for the "west" "istio-system"
    And health should be different for "east" and "west" "istio-system"

  @multi-cluster
  Scenario: See "bookinfo" in "east" and "west" clusters
    Then user sees the "bookinfo" namespace card in cluster "east"
    And user sees the "bookinfo" namespace card in cluster "west"
    And Istio config should not be available for the "west" "bookinfo"
    And health should be different for "east" and "west" "bookinfo"

  @multi-cluster
  Scenario: The healthy status of a logical mesh application is reported in the overview of a remote cluster namespace
    Given a healthy application in the remote cluster
    When I fetch the overview of the cluster
    Then there should be a "healthy" application indicator in the namespace in the "west" cluster
    And the "healthy" application indicator for the "west" cluster should list the application

  @multi-cluster
  Scenario: The idle status of a logical mesh application is reported in the overview of a remote cluster namespace
    Given an idle application in the remote cluster
    When I fetch the overview of the cluster
    Then there should be a "idle" application indicator in the namespace in the "west" cluster
    And the "idle" application indicator for the "west" cluster should list the application

  @multi-cluster
  Scenario: See cluster badges in the COMPACT view
    When user clicks in the "COMPACT" view
    Then user sees a "COMPACT" "bookinfo" namespace
    Then user sees the "bookinfo" namespace card in cluster "east"
    And user sees the "bookinfo" namespace card in cluster "west"

  @multi-cluster
  Scenario: See cluster badges in the LIST view
    When user clicks in the "LIST" view
    Then user sees a "LIST" "bookinfo" namespace
    And the "Cluster" column "appears"
    And cluster badges for "east" and "west" cluster are visible in the LIST view

  #this scenario refers to a bug (https://github.com/kiali/kiali/issues/6504) which is not resolved at the time of writing the scenario
  # this scenario refers to a bug (https://github.com/kiali/kiali/issues/6504)
  @multi-cluster
  Scenario: The new Cluster column should be visible and sortable when changing to list view
    When user clicks in the "LIST" view
    Then the "Cluster" column "appears"
    And user sorts by column "Cluster" desc
    Then the list is sorted by "Cluster" desc

  @multi-cluster
  @multi-primary
  Scenario: There should be two control plane cards for each cluster
    Then user sees the "Control plane" label in the "east" "istio-system" namespace card
    Then user sees the "Control plane" label in the "west" "istio-system" namespace card

  @ambient
  Scenario: Istio panels for cluster should be visible and have the ambient label
    Then user sees the "Control plane" label in the "istio-system" namespace card
    Then user sees the "Ambient" label in the "istio-system" namespace card

  @ambient
  Scenario: See ambient badge in the COMPACT view
    When user clicks in the "COMPACT" view
    Then user sees a "COMPACT" "bookinfo" namespace
    Then user sees the "bookinfo" namespace card
    And user sees the "Ambient" label in the "istio-system" namespace card

  @ambient
  Scenario: See ambient badge in the LIST view
    When user clicks in the "LIST" view
    Then user sees a "LIST" "istio-system" namespace
    And badge for "Ambient" is visible in the LIST view in cluster "cluster-default" and namespace "istio-system"
