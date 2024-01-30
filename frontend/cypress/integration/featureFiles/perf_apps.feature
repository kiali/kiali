@apps
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Apps List page and details pages performance tests

  Background:
    Given user is at administrator perspective

  @performance
  Scenario: Measures Apps objects loading in all namespaces.
    Given user is at the "applications" list page
    And user selects all namespaces
    Then user sees all the Apps in the bookinfo namespace
