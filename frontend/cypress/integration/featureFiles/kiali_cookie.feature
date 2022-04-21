Feature: Kiali login cookie

  Smoke to verify cy.login function is working and stores cookies into session
  

  Background: 
    Given user is at administrator perspective
  
  Scenario: Open Kaili home page
    And user visits base url
    Then user see console in URL

  Scenario: Open Kaili home page2
    And user visits base url
    Then user see console in URL

  
