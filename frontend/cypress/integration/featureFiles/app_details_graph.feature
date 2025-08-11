@app-details
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali App Details page

  Some App Details minigraph tests, which required a different setup.

  Background:
    Given user is at administrator perspective
    And user is at the details page for the "app" "bookinfo/details" located in the "" cluster

  @bookinfo-app
  @base
  Scenario: See app minigraph for details app.
    Then user sees a minigraph