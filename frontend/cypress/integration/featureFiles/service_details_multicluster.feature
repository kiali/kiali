@multi-cluster
@service-details-multi-cluster
Feature: Kiali Service Details page for remote cluster

  User opens the Services page and sees the bookinfo namespaces,
  clicks in the productpage service, and page loads correctly.

  Background:
    Given user is at administrator perspective
    And user is at the details page for the "service" "bookinfo/ratings" located in the "west" cluster

  Scenario: See details for remote service
    Then sd::user sees "ratings" details information for the remote service "v1"
    And links in the "Service" description card should contain a reference to a "west" cluster
    And cluster badge for "west" cluster should be visible in the "Service" description card

  Scenario: See service minigraph for details app.
    Then sd::user sees a minigraph
    And user sees "service" from a remote "west" cluster

  Scenario: Minigraph should not be visible for a service, which is not deployed in specific cluster.
    And user is at the details page for the "service" "bookinfo/details" located in the "west" cluster
    Then user does not see a minigraph

  Scenario: See service Traffic information
    Then sd::user sees inbound and outbound traffic information for the remote service
    And user should see columns related to cluster info for the inbound and outbound traffic

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
    And user sees tracing warning
    When user selects a trace
    Then user sees trace details

  Scenario: See span info after selecting service span
    And user sees trace information
    When user selects a trace
    Then user sees span details

  Scenario: See details for a service, which is not present in the specific cluster.
    And user is at the details page for the "service" "bookinfo/ratings" located in the "east" cluster
    And links in the "Service" description card should contain a reference to a "east" cluster
    And cluster badge for "east" cluster should be visible in the "Service" description card
    And user does not see a minigraph

  Scenario: See no app Traffic information for a service, which is not present in the specific cluster.
    And user is at the details page for the "service" "bookinfo/ratings" located in the "east" cluster
    Then user does not see any inbound and outbound traffic information

  # skipped due to unknown Prometheus issue 
  @skip
  Scenario: See no Inbound Metrics for a service, which is not present in the specific cluster. 
    And user is at the details page for the "service" "bookinfo/ratings" located in the "east" cluster
    Then user does not see "Inbound" metrics information for the remote "ratings" "service"

  @skip
  Scenario: See no Outbound Metrics for a service, which is not present in the specific cluster. 
    And user is at the details page for the "service" "bookinfo/ratings" located in the "east" cluster
    Then user does not see "Outbound" metrics information for the remote "ratings" "service"

  # skipped until https://github.com/kiali/kiali/issues/6710 gets resolved
  @skip
  Scenario: See no tracing info for a service, which is not present in the specific cluster
    And user is at the details page for the "service" "bookinfo/ratings" located in the "east" cluster
    And user does not see any traces
