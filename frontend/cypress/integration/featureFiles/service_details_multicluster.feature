@multi-cluster
@service-details-page
Feature: Kiali Service Details page for remote cluster

  User opens the Services page and sees the bookinfo namespaces,
  clicks in the productpage service, and page loads correctly.

  Background:
    Given user is at administrator perspective
    And user is at the details page for the "service" "bookinfo/ratings" located in the "west" cluster

  @skip
  Scenario: See details for remote service
    Then sd::user sees "ratings" details information for service "v1"
    And cluster badge for "west" cluster should be visible

  @skip
  Scenario: See service minigraph for details app.
    Then sd::user sees a minigraph
    And user sees "service" from a remote "west" cluster

  @skip
  Scenario: Minigraph should not be visible for a service, which is not deployed in specific cluster.
    And user is at the details page for the "service" "bookinfo/details" located in the "west" cluster
    Then user does not see a minigraph

  @skip
  Scenario: See service Traffic information
    Then sd::user sees inbound and outbound traffic information
    And user should see a column related to cluster info

  Scenario: See Inbound Metrics for ratings service details
    Then sd::user sees "Request volume" graph
    Then sd::user sees "Request duration" graph
    Then sd::user sees "Request size" graph
    Then sd::user sees "Response size" graph
    Then sd::user sees "Request throughput" graph
    Then sd::user sees "Response throughput" graph
    Then sd::user sees "gRPC received" graph
    Then sd::user sees "gRPC sent" graph
    Then sd::user sees "TCP opened" graph
    Then sd::user sees "TCP closed" graph
    Then sd::user sees "TCP received" graph
    Then sd::user sees "TCP sent" graph

  Scenario: See Graph data for ratings service details Inbound Metrics graphs
    Then sd::user does not see No data message in the "Request volume" graph

  Scenario: See graph traces for ratings service details
    And user sees trace information
    When user selects a trace
    Then user sees trace details

  Scenario: See span info after selecting service span
    And user sees trace information
    When user selects a trace
    Then user sees span details
