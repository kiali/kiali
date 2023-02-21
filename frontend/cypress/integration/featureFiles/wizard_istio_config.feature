@istio-page
Feature: Kiali Istio Config page

  On the Istio Config page, an admin should see all the Istio Config objects.
  The admin should be able to filter for the Istio Config objects they are looking for
  and create new Istio objects.

  Background:
    Given user is at administrator perspective
    And user is at the "istio" page
    And user selects the "bookinfo" namespace

  @wizard-istio-config
  Scenario: Create a K8s Gateway scenario
    And user clicks in the "K8sGateway" Istio config actions
    And user sees the "Create K8sGateway" config wizard
    And user adds listener
    And user types "k8sapigateway" in the name input
    And user types "listener" in the add listener name input
    And user checks validation of the hostname input
    And user types "website.com" in the add hostname input
    And user types "8080" in the add port input
    And user previews the configuration
    And user creates the istio config
    Then the K8sGateway "k8sapigateway" should be listed in "bookinfo" namespace
