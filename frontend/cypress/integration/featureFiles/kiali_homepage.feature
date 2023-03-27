Feature: Kiali login

  I want to login to Kiali and see landing page

  @smoke  
  Scenario: Kaili is present in the page title
    Given I open Kiali URL
    Then I see "Kiali" in the title