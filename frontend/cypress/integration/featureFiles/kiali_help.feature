Feature: Kiali help

  User wants to login to Kiali and view kiali help like documentation, view bebug info, certificate information, about info

  Scenario: Login to Kiali and Open Kiali home page
    Given user opens base url
    And user clicks Log In With OpenShift
    And user clicks my_htpasswd_provider
    And user fill in username and password
    Then user see console in URL
  
  @help-links
  Scenario: Click and view kiali Debug information
    When user clicks view debug info link
    Then user verifies debug info dialog box and closes the dialo box
