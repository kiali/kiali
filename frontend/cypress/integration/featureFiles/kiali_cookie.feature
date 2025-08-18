Feature: Kiali login cookie

  Smoke to verify cy.login function is working and stores cookies into session

  Background:
    Given user is at administrator perspective

  @smoke
  @core
  Scenario: Console is visible after login
    And user visits base url
    Then user see console in URL


