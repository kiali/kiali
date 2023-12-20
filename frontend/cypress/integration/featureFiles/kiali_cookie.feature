@smoke
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali login cookie

  Smoke to verify cy.login function is working and stores cookies into session

  Background:
    Given user is at administrator perspective

  Scenario: Console is visible after login
    And user visits base url
    Then user see console in URL


