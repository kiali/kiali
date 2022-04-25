Feature: Kiali user

  User wants to verify login user

  Scenario: locate user on kiali page and verify
    Given user opens base url
    And user clicks Log In With OpenShift
    And user clicks my_htpasswd_provider
    And user fill in username and password
    And user see console in URL
    Then user locate User in UI and verify
