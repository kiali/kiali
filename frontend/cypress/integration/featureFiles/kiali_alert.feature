Feature: Kiali help about verify

  User does not want to see any alerts when opening a fresh installation of Kiali

  Background:
    Given user is at administrator perspective
    And user is at the "overview" page

  @smoke
  @core-2
  Scenario: Open Kiali notifications
    Then user should see no Istio Components Status

  @multi-cluster
  Scenario: Open Kiali notifications
    Then user should see no Istio Components Status
