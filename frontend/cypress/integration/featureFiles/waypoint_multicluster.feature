@waypoint-multicluster
# don't change first line of this file - the tag is used for the test scripts to identify the test suite
Feature: Kiali Waypoint in Ambient Multi-Primary (multi-cluster)

  Validates that a waypoint proxy is installed in an ambient multi-primary setup and that the traffic graph
  can correctly show waypoint proxies across clusters.

  Background:
    Given user is at administrator perspective
    And the waypoint "waypoint" in namespace "bookinfo-waypoints" in cluster "east" is healthy
    And the waypoint "waypoint" in namespace "bookinfo-waypoints" in cluster "west" is healthy
    And the graph page has enough data for L7 in the "bookinfo-waypoints" namespace

  Scenario: [Traffic Graph] Waypoint proxies are hidden by default and can be shown across clusters
    Given user is at the "graph" page
    When user graphs "bookinfo-waypoints" namespaces
    And user selects "WORKLOAD" graph type
    Then user sees the "bookinfo-waypoints" namespace
    And the "waypoint" node "doesn't" exists
    Then user "opens" traffic menu
    And user "enables" "ambient" traffic option
    And user "enables" "ambientTotal" traffic option
    And user "closes" traffic menu
    When user "opens" display menu
    And user "enables" "waypoint proxies" option
    And user "closes" display menu
    Then the waypoint node "waypoint" is visible in the graph for the "east" cluster
    And the waypoint node "waypoint" is visible in the graph for the "west" cluster
    And user sees graph workloads from both clusters

  Scenario: [Traffic Graph] Verify L7 waypoint traffic across clusters
    Given user is at the "graph" page
    When user graphs "bookinfo-waypoints" namespaces
    And user selects "WORKLOAD" graph type
    Then user sees the "bookinfo-waypoints" namespace
    When user "opens" traffic menu
    And user "enables" "ambient" traffic option
    And user "enables" "ambientWaypoint" traffic option
    And user "closes" traffic menu
    Then 7 edges appear in the graph
    And there is traffic from cluster "east" and cluster "west"
    # TODO: At the moment (Istio 1.28) The telemetry is incomplete, no interconnection between edges in the clusters
    # Once is fixed, validate the interconnection

  Scenario: [Waypoint enrolled] Verify productpage-v1 workload is enrolled in east cluster
    Given user is at the details page for the "workload" "bookinfo-waypoints/productpage-v1" located in the "east" cluster
    Then the user sees the L7 "waypoint" link

  Scenario: [Waypoint enrolled] Verify ratings-v1 workload is enrolled in west cluster
    Given user is at the details page for the "workload" "bookinfo-waypoints/ratings-v1" located in the "west" cluster
    Then the user sees the L7 "waypoint" link
    And the waypoint link points to the "west" cluster


