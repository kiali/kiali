Feature: Kiali help about verify

  User wants to verfiy the  Kiali in help button
  
  Background: 
    Given user is at administrator perspective

  Scenario: Open Kaili about page

    And user clicks on Help Button
    And user clicks on About Button
    Then user see Kiali brand
    