@service-details
@ossmc
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Service Details page

  User opens the Services page and sees the bookinfo namespaces,
  clicks in the productpage service, and page loads correctly.

  Background:
    Given user is at administrator perspective
    And user is at the details page for the "service" "bookinfo/productpage" located in the "" cluster

  @bookinfo-app
  Scenario: See details for productpage
    Then sd::user sees a list with content "Overview"
    Then sd::user sees a list with content "Traffic"
    Then sd::user sees a list with content "Inbound Metrics"
    Then sd::user sees a list with content "Traces"
    Then sd::user sees the service actions

  @bookinfo-app
  Scenario: See details for service
    Then sd::user sees "productpage" details information for service "v1"
    Then sd::user sees Network card
    Then sd::user sees Istio Config
    But no cluster badge for the "service" should be visible

  @bookinfo-app
  Scenario: See service Traffic information
    Then sd::user sees inbound and outbound traffic information
    And the "Cluster" column "disappears"

  @bookinfo-app
  Scenario: See Inbound Metrics for productspage service details
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

  @bookinfo-app
  Scenario: See Graph data for productspage service details Inbound Metrics graphs
    Then sd::user does not see No data message in the "Request volume" graph

  @bookinfo-app
  @tracing
  @waypoint-tracing
  Scenario: See graph traces for productspage service details
    And user sees trace information
    When user selects a trace
    Then user sees trace details

  @bookinfo-app
  @tracing-tracing
  Scenario: See span info after selecting service span
    And user sees trace information
    When user selects a trace
    Then user sees span details
