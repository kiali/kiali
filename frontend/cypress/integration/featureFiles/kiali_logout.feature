Feature: Kiali logout

  User wants to login to Kiali and see landing page
  
  @smoke
  Scenario: Kiali logout successfully
    Given user opens base url
    And user clicks Log In With OpenShift
    And user clicks my_htpasswd_provider
    And user fill in username and password
    And user see console in URL
    And user clicks on admin
    And user logout successfully
    Then user verify the logout