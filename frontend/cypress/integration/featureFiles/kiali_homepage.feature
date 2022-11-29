Feature: Kiali login

  After login, I want to see Kiali landing page

  Background:
    Given user is at administrator perspective

  @smoke  
  Scenario: Open Kaili home page and check for title
    And I open Kiali URL
    Then I see "Kiali" in the title