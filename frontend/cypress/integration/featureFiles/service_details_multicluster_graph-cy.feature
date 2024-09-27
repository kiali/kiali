@multi-cluster
@service-details-multi-cluster
Feature: Kiali Service Details page for remote cluster

  User opens the Services page and sees the bookinfo namespaces,
  clicks in the productpage service, and page loads correctly.

  Background:
    Given user is at administrator perspective
    And user is at the details page for the "service" "bookinfo/ratings" located in the "west" cluster

  Scenario: See service minigraph for details app.
    Then sd::user sees a cytoscape minigraph
    And user sees "service" from a remote "west" cluster in the cytoscape minigraph

  Scenario: Minigraph should not be visible for a service, which is not deployed in specific cluster.
    And user is at the details page for the "service" "bookinfo/details" located in the "west" cluster
    Then user does not see a cytoscape minigraph
