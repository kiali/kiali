@smoke
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali login

  User wants to login to Kiali and see landing page

  Scenario: Try to log in without filling the username and password
    Given all sessions are cleared
    And user opens base url
    And user clicks my_htpasswd_provider
    And user does not fill in username and password
    Then user sees the "Login is required. Please try again." phrase displayed

  Scenario: Try to log in with an invalid username
    Given all sessions are cleared
    And user opens base url
    And user clicks my_htpasswd_provider
    And user fills in an invalid username
    Then user sees the "Invalid login or password. Please try again." phrase displayed

  Scenario: Try to log in with an invalid password
    Given all sessions are cleared
    And user opens base url
    And user clicks my_htpasswd_provider
    And user fills in an invalid password
    Then user sees the "Invalid login or password. Please try again." phrase displayed

  Scenario: Try to log in with a valid password
    Given all sessions are cleared
    And user opens base url
    And user clicks my_htpasswd_provider
    And user fills in a valid password
    Then user sees the Overview page

  @openshift
  Scenario: Openshift login shows error message when code exchange fails
    Given all sessions are cleared
    And user opens base url
    And the server will return a login error
    And user clicks my_htpasswd_provider
    And user fills in a valid password
    Then user sees an error message on the login form
    And the error description is in the url

  @openshift
  @multi-cluster
  Scenario: Login to two different openshift clusters.
    Given all sessions are cleared
    And user opens base url
    And user clicks my_htpasswd_provider
    And user fills in a valid password
    And user sees the Overview page
    And user sees the "east,west" clusters in the profile dropdown
    When user clicks the "west" cluster in the profile dropdown
    And user clicks my_htpasswd_provider
    And user fills in a valid password for "west" cluster
    Then user sees the Overview page

  @requireslogin
  Scenario: An expiring session should show a pop up to renew.
    Given user is at administrator perspective
    And user session is expiring soon
    When user opens base url
    Then user sees the session timeout modal
    When user clicks logout on the session timeout modal
    # TODO: When logout is properly supported the user should land on the login page
    # which will be different depending on the auth strategy.
    # Right now logout clears the kiali cookie but does not clear the cookie
    # from the idp so logout will result in a redirect to the idp which will
    # instantly re-authenticate with the saved idp cookie and redirect back
    # to Kiali to re-login the user to kiali.
    # Then user sees the login page
