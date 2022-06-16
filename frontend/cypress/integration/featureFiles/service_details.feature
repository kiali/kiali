Feature: Kiali Service Details page

  User opens the Services page and sees the bookinfo namespaces,
  clicks in the productpage service, and page loads correctly.

  Background:
    Given user is at administrator perspective
    And user is at a valid "service details" page

  @service-details-page
  Scenario: See a table with correct info
    When user selects the "productspage" service
    Then user sees a table with headings
      | Overview | Traffic | Inbound Metrics | Traces |
    And the "productpage" grid item is visible
    And the "Network" grid item is visible
    And the "Istio Config" grid item is visible
    And the "Graph" grid is visible

  @service-details-page
  Scenario: See "Traffic" for "productspage" service details
    When the user clicks in the "traffic" tab
    Then user sees Inbound Traffic in the pages
    And user sees Outbound Traffic in the pages

 @service-details-page
 Scenario: See "Inbound Metrics" for "productspage" service details
    When the user clicks in the "Inbound Metrics" tab
    Then the user sees "Request Volume" graph
    And the user sees "Request Volume" graph
    the user sees "Request Volume" graph
    the user sees "Request duration" graph
    the user sees "Request size" graph
    the user sees "Response size" graph
    the user sees "Request throughput" graph
    the user sees "Response throughput" graph
    the user sees "gRPC received" graph
    the user sees "gRPC sent" graph
    the user sees "TCP opened" graph
    the user sees "TCP closed" graph
    the user sees "TCP received" graph
    the user sees "TCP sent" graph

 @service-details-page
 Scenario: See "Outbound Metrics" for "productspage" service details
    When the user clicks in the "Outbound Metrics" tab
    Then the user sees "Request Volume" graph
    And the user sees "Request Volume" graph
    the user sees "Request Volume" graph
    the user sees "Request duration" graph
    the user sees "Request size" graph
    the user sees "Response size" graph
    the user sees "Request throughput" graph
    the user sees "Response throughput" graph
    the user sees "gRPC received" graph
    the user sees "gRPC sent" graph
    the user sees "TCP opened" graph
    the user sees "TCP closed" graph
    the user sees "TCP received" graph
    the user sees "TCP sent" graph

  @services-page
  Scenario: See "Traces" for "productspage" service details
    When the user clicks in the "Traces" tab
    Then user sees "traces" in the table