@workload-details
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Workload Details page

  On the Workload Details page, the user should see the details of a workload as well as
  a minigraph for traffic going to and originating from the workload. In addition,
  there should be tabs for viewing workload specific traffic, inbound/outbound metrics, traces and Envoy information, including metrics.

  Background:
    Given user is at administrator perspective
    And user is at the details page for the "workload" "bookinfo/details-v1" located in the "" cluster

  @bookinfo-app
  @record
  Scenario: See details for workload
    Then user sees details information for workload
    But no cluster badge for the "workload" should be visible

  @bookinfo-app
  Scenario: See minigraph for workload.
    Then user sees a minigraph

  @bookinfo-app
  Scenario: See workload traffic information
    Then user sees workload inbound and outbound traffic information
    And the "Cluster" column "disappears"

  @bookinfo-app
  Scenario: See workload Inbound Metrics
    Then user sees workload inbound metrics information

  @bookinfo-app
  Scenario: See workload Outbound Metrics
    Then user sees workload outbound metrics information

  @bookinfo-app
  @tracing
  Scenario: See workload tracing info after selecting a trace
    And user sees trace information
    When user selects a trace
    Then user sees trace details

  @bookinfo-app
  @tracing
  Scenario: See workload span info after selecting a span
    And user sees trace information
    When user selects a trace
    And user sees span details
    And user can filter spans by workload

  @bookinfo-app
  @tracing
  Scenario: See tracing links
    And user sees trace information
    Then the user can see the "View in Tracing" link
    When user selects a trace
    Then the user can see the "View in Tracing" trace link
    And user sees span details
    Then the user can see the "More span details" span link

  @bookinfo-app
  Scenario: See Envoy clusters configuration for a workload
    When the user filters by "Port" with value "9080" on the "Clusters" tab
    Then the user sees clusters expected information

  @requestTimeout(30000)
  @responseTimeout(30000)
  @bookinfo-app
  Scenario: See Envoy listeners configuration for a workload
    When the user filters by "Destination" with value "Route: 9090" on the "Listeners" tab
    Then the user sees listeners expected information

  @bookinfo-app
  Scenario: See Envoy routes configuration for a workload
    When the user filters by "Domains" with value "details" on the "Routes" tab
    Then the user sees routes expected information

  @bookinfo-app
  Scenario: See Envoy bootstrap configuration for a workload
    When the user looks for the bootstrap tab
    Then the user sees bootstrap expected information

  @bookinfo-app
  Scenario: See Envoy config configuration for a workload
    When the user looks for the config tab
    Then the user sees bootstrap expected information

  @bookinfo-app
  Scenario: See Envoy metrics for a workload
    Then the user sees the metrics tab
