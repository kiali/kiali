@smoke
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali help about verify

  User does not want to see any alerts when opening a fresh installation of Kiali

  Background:
    Given user is at administrator perspective
    And user is at the "overview" page

  @base
  Scenario: Open Kiali notifications
    Then user should see no Istio Components Status

  @multi-cluster
  Scenario: Open Kiali notifications
    Then user should see no Istio Components Status
