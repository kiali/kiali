@app-details
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali App Details page

  Some App Details minigraph tests, which required a different setup.

  Background:
    Given user is at administrator perspective
    And user is at the details page for the "app" "bookinfo/details" located in the "" cluster

  @bookinfo-app
  @core-1
  Scenario: See app minigraph for details app.
    Then user sees a minigraph

  @error-rates-app
  @core-1
  Scenario: Application detail URL stays under applications after the mini graph loads
    Given user is at the details page for the "app" "alpha/a-client" located in the "" cluster
    Then user sees a minigraph
    And the browser URL should include "applications/a-client"
    And the browser URL should not include "/workloads/"