@smoke
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali logout

  User wants to logout to Kiali

  Background:
    Given user is at administrator perspective
    And user is at the "overview" page

  @core
  Scenario: Kiali logout successfully
    And user clicks on admin
    And user logout successfully
    Then user verify the logout