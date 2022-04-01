Feature: Kiali login

  I want to login to Kiali and see landing page
  
  @focus
  Scenario: Open Kaili home page
    Given I open Kiali URL
    Then I see "Kiali" in the title