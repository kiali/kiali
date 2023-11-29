@smoke
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: authorization and smoke test for various platforms
  Smoke to verify cy.login function is working for multiple platforms (Kiali, Openshift Web Console)

  Scenario: Kiali console is visible after login
    Given user is at administrator perspective
    And user visits base url
    Then user see console in URL

  @ossmc
  Scenario: Kiali plugin is visible in Openshift Web Console when logged as admin
    Given user is logged as administrator in Openshift Web Console


