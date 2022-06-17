Feature: Kiali Service Details page

  User opens the Services page and sees the bookinfo namespaces,
  clicks in the productpage service, and page loads correctly.

  Background:
    Given user is at administrator perspective
    And user is at the details page for the "service" "bookinfo/productpage"

  @service-details-page
  Scenario: See details for productpage
    Then user sees a list with content "Overview"
    Then user sees a list with content "Traffic"
    Then user sees a list with content "Inbound Metrics"
    Then user sees a list with content "Traces"

  @service-details-page
  Scenario: See details for service
    Then user sees productpage details information for service

  @app-details-page
  Scenario: See minigraph for details app.
    Then user sees a minigraph

  @service-details-page
  Scenario: See Traffic information
    Then user sees inbound and outbound traffic information

  @service-details-page
  Scenario: See Inbound Metrics for productspage service details
    Then the user sees "Request volume" graph
    Then the user sees "Request duration" graph
    Then the user sees "Request size" graph
    Then the user sees "Response size" graph
    Then the user sees "Request throughput" graph
    Then the user sees "Response throughput" graph
    Then the user sees "gRPC received" graph
    Then the user sees "gRPC sent" graph
    Then the user sees "TCP opened" graph
    Then the user sees "TCP closed" graph
    Then the user sees "TCP received" graph
    Then the user sees "TCP sent" graph

  @service-details-page
  Scenario: See Graph data for productspage service details Inbound Metrics graphs
    Then the user does not see No data message in the "Request volume" graph
