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
  Scenario: See service minigraph for details app.
    Then user sees a minigraph

  @bookinfo-app
  @skip-ossmc
  Scenario: Verify that the Graph type dropdown is disabled when changing to Show node graph
    When user sees a minigraph
    And user chooses the "Show node graph" option
    Then the graph type is disabled
