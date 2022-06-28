Feature: Kiali logout

  User wants to logout to Kiali

  Background:
    Given user is at administrator perspective
    And user is at the "overivew" page

  @smoke
  Scenario: Kiali logout successfully

    And user clicks on admin
    And user logout successfully
    Then user verify the logout