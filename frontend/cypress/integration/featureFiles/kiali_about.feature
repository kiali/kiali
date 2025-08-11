@smoke
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali help about verify

  User wants to verify the Kiali help about information

  Background:
    Given user is at administrator perspective
    And user is at the "overview" page

  @base
  Scenario: Open Kiali about page

    And user clicks on Help Button
    And user clicks on About Button
    Then user see Kiali brand
