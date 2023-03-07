Feature: Kiali Workload Details page

  On the Workload Details page, the user should see the details of a workload as well as
  a minigraph for traffic going to and originating from the workload. In addition,
  there should be tabs for viewing workload specific traffic, inbound/outbound metrics, traces and Envoy information, including metrics.

  Background:
    Given user is at administrator perspective
    And user is at the details page for the "workload" "bookinfo/details-v1"

  @workload-details
  Scenario: See details for workload
    Then user sees details information for workload

  @workload-details
  Scenario: See minigraph for workload.
    Then user sees a minigraph

  @workload-details
  Scenario: See workload traffic information
    Then user sees workload inbound and outbound traffic information

  @workload-details
  Scenario: See workload Inbound Metrics
    Then user sees workload inbound metrics information

  @workload-details
  Scenario: See workload Outbound Metrics
    Then user sees workload outbound metrics information

  @workload-details
  Scenario: See workload tracing info after selecting a trace
    And user sees trace information
    When user selects a trace
    Then user sees trace details

  @workload-details
  Scenario: See workload span info after selecting a span
    And user sees trace information
    When user selects a trace
    And user sees span details
    And user can filter spans by workload

  @workload-details
  Scenario: See Envoy clusters configuration for a workload
    When the user filters by "Port" with value "9080" on the "Clusters" tab
    Then the user sees clusters expected information

  @workload-details
  Scenario: See Envoy listeners configuration for a workload
    When the user filters by "Destination" with value "Route: 9090" on the "Listeners" tab
    Then the user sees listeners expected information

  @workload-details
  Scenario: See Envoy routes configuration for a workload
    When the user filters by "Domains" with value "details" on the "Routes" tab
    Then the user sees routes expected information

  @workload-details
  Scenario: See Envoy bootstrap configuration for a workload
    When the user looks for the bootstrap tab
    Then the user sees bootstrap expected information

  @workload-details
  Scenario: See Envoy config configuration for a workload
    When the user looks for the config tab
    Then the user sees bootstrap expected information

  @workload-details
  Scenario: See Envoy metrics for a workload
    Then the user sees the metrics tab
