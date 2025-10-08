@workload-details-multi-cluster
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

@multi-cluster
Feature: Kiali Workload Details page

  On the Workload Details page, the user should see the details of a workload located in a remote cluster, as well as
  a minigraph for traffic going to and originating from the workload. In addition,
  there should be tabs for viewing workload specific traffic, inbound/outbound metrics and Envoy information, including metrics.

  Background:
    Given user is at administrator perspective
    And user is at the details page for the "workload" "bookinfo/reviews-v2" located in the "west" cluster

  Scenario: See details for workload
    Then user sees details information for a remote workload
    And links in the "Workload" description card should contain a reference to a "west" cluster
    And cluster badge for "west" cluster should be visible in the "Workload" description card

  Scenario: See workload traffic information
    Then user sees workload inbound and outbound traffic information for the remote workload
    And user should see columns related to cluster info for the inbound and outbound traffic

  Scenario: See workload Inbound Metrics
    Then user sees "Inbound" metrics information for the remote "reviews-v2" "workload"

  Scenario: See workload Outbound Metrics
    Then user sees "Outbound" metrics information for the remote "reviews-v2" "workload"

  Scenario: See workload span info after selecting a span
    And user sees trace information
    When user selects a trace with at least 6 spans
    And user sees span details
    And user can filter spans by workload "details-v1"

  Scenario: Don't see tracing info
    And user is at the details page for the "workload" "bookinfo/reviews-v3" located in the "west" cluster
    Then user see no traces

  Scenario: See Envoy clusters configuration for a workload
    When the user filters by "Port" with value "9080" on the "Clusters" tab
    Then the user sees clusters expected information

  Scenario: See Envoy listeners configuration for a workload
    When the user filters by "Destination" with value "Route: 9090" on the "Listeners" tab
    Then the user sees listeners expected information

  Scenario: See Envoy routes configuration for a workload
    When the user filters by "Domains" with value "details" on the "Routes" tab
    Then the user sees routes expected information

  Scenario: See Envoy bootstrap configuration for a workload
    When the user looks for the bootstrap tab
    Then the user sees bootstrap expected information

  Scenario: See Envoy config configuration for a workload
    When the user looks for the config tab
    Then the user sees bootstrap expected information

  Scenario: See Envoy metrics for a workload
    Then the user sees the metrics tab

  Scenario: See details for a workload, which is not present in the specific cluster.
    And user is at the details page for the "workload" "bookinfo/ratings-v1" located in the "east" cluster
    And links in the "Workload" description card should contain a reference to a "east" cluster
    And cluster badge for "east" cluster should be visible in the "Workload" description card

  Scenario: See no app Traffic information for a workload, which is not present in the specific cluster.
    And user is at the details page for the "workload" "bookinfo/ratings-v1" located in the "east" cluster
    Then user does not see any inbound and outbound traffic information

  Scenario: See no Inbound Metrics for a workload, which is not present in the specific cluster.
    And user is at the details page for the "workload" "bookinfo/ratings-v1" located in the "east" cluster
    Then user does not see "Inbound" metrics information for the "east" "ratings-v1" "workload"

  Scenario: See no Outbound Metrics for a workload, which is not present in the specific cluster.
    And user is at the details page for the "workload" "bookinfo/ratings-v1" located in the "east" cluster
    Then user does not see "Outbound" metrics information for the "east" "ratings-v1" "workload"

  Scenario: Envoy tab should not be visible for a workload, which is not present in specific cluster
    And user is at the details page for the "workload" "bookinfo/ratings-v1" located in the "east" cluster
    Then the envoy tab should not be visible
