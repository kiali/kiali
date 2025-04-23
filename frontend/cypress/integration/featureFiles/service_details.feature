@service-details
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Service Details page

  User opens the Services page and sees the bookinfo namespaces,
  clicks in the productpage service, and page loads correctly.

  Background:
    Given user is at administrator perspective
    And user is at the details page for the "service" "bookinfo/productpage" located in the "" cluster

  # Jaeger is not available in OCP 4.19, and we don't have Tempo setup yet in LPINTEROP pipelines (will be for OSSM3+)
  @skip-lpinterop
  @bookinfo-app
  Scenario: See details for productpage
    Then sd::user sees a list with content "Overview"
    Then sd::user sees a list with content "Traffic"
    Then sd::user sees a list with content "Inbound Metrics"
    Then sd::user sees a list with content "Traces"
    Then sd::user sees the actions button

  @bookinfo-app
  Scenario: See details for service
    Then sd::user sees "productpage" details information for service "v1"
    Then sd::user sees Network card
    Then sd::user sees Istio Config

  @bookinfo-app
  Scenario: See service minigraph for details app.
    Then sd::user sees a minigraph

  @bookinfo-app
  Scenario: See service Traffic information
    Then sd::user sees inbound and outbound traffic information

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

  # Jaeger is not available in OCP 4.19, and we don't have Tempo setup yet in LPINTEROP pipelines (will be for OSSM3+)
  @skip-lpinterop
  @bookinfo-app
  Scenario: See graph traces for productspage service details
    And user sees trace information
    When user selects a trace
    Then user sees trace details

  # Jaeger is not available in OCP 4.19, and we don't have Tempo setup yet in LPINTEROP pipelines (will be for OSSM3+)
  @skip-lpinterop
  @bookinfo-app
  Scenario: See span info after selecting service span
    And user sees trace information
    When user selects a trace
    Then user sees span details

  @bookinfo-app
  Scenario: Verify that the Graph type dropdown is disabled when changing to Show node graph
    When user sees a minigraph
    And user chooses the "Show node graph" option
    Then the graph type is disabled

  @multi-cluster
  @skip
  Scenario: See details for service
    Then sd::user sees "productpage" details information for service "v1"
    And sd::user sees Network card
    And sd::user sees Istio Config
    And cluster badge for "east" cluster should be visible

  @multi-cluster
  @skip
  Scenario: See service Traffic information
    Then sd::user sees inbound and outbound traffic information
    And user should see a column related to cluster info
