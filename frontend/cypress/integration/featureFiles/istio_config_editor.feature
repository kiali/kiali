@istio-config-editor
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Istio Config editor page

  These tests are realted to Istio Config edior.

  Background:
    Given user is at administrator perspective
    And user is at the "istio" page
    And user selects the "bookinfo" namespace

  @bookinfo-app
  Scenario: Filter Istio Config editor objects by Valid configuration
    When the user filters by "Config" for "Valid"
    And user sees "bookinfo-gateway"
    And user sees "bookinfo"
    And user clicks in "Name" column on the "bookinfo" text
    Then user can see istio config editor
    But no cluster badge for the "Istio config" should be visible
