@overview
Feature: New Overview - Istio configs summary card

  Background:
    Given user is at administrator perspective

  Scenario: View all warning Istio configs includes namespaces and filters
    Given Istio configs API returns at least 4 warning configs
    And user is at the "overview" page
    When user opens the Istio configs warnings popover
    And user clicks the "View warning Istio configs" popover action
    Then user is redirected to Istio config list with all namespaces and warning filters

