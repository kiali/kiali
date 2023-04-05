Feature: Kiali login

  User wants to login to Kiali and see landing page

  Background:  
    Given user opens base url
    And user clicks my_htpasswd_provider

  Scenario: Verify console URL
    And user fill in username and password
    Then user see console in URL