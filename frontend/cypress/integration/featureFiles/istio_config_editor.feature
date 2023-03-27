@istio-page
Feature: Kiali Istio Config editor page

  This tests are realted to Istio Config edior.

  Background:
    Given user is at administrator perspective
    And user is at the "istio" page
    And user selects the "bookinfo" namespace

  Scenario: Verify editor loads correctly
    When the user filters by "Config" for "Valid"
    And user sees "bookinfo-gateway"
    And user sees "bookinfo"
    And user clicks in "Name" column on the "bookinfo" text
    Then user can see istio config editor
