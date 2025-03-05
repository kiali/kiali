@smoke
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali login

  User wants to login to Kiali and see landing page

  Background:
    Given user opens base url
    And user clicks my_htpasswd_provider

  Scenario: Try to log in with an invalid username
    And user fills in an invalid username
    Then user sees the "Invalid login or password. Please try again." phrase displayed

  Scenario: Try to log in with an invalid password
    And user fills in an invalid password
    Then user sees the "Invalid login or password. Please try again." phrase displayed

  Scenario: Try to log in with a valid password
    And user fills in a valid password
    Then user sees the Overview page
