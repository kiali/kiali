@istio-config-validation
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Istio Config page

  On the Istio Config page, an admin should be able to choose all of the filters present.
  The admin should also be able close a single filter either with it's cross, or with the Close All feature.

  Background:
    Given user is at administrator perspective
    And user is at the "istio" page
    And user selects the "istio-system" namespace
    And user filters by "Config"
    And no filters are active

  @smoke
  @core
  Scenario: Filters should be available in the dropdown
    Then user can see the Filter by Config Validation dropdown
    And the dropdown contains all of the filters

  @smoke
  @core
  Scenario: Single validation filter should be usable
    When a validation filter is chosen from the dropdown
    Then the filter is applied and visible

  @smoke
  @core
  Scenario: Filter should be deletable
    When a validation filter "Valid" is applied
    And user clicks the cross next to the "Valid"
    Then the filter is no longer active

  @smoke
  @core
  Scenario: Deleting all filters at once
    When a validation filter "Valid" is applied
    And user clicks on "Clear all filters"
    Then the filter is no longer active

  @smoke
  @core
  Scenario: When 4 or more filters are chosen, only 3 are visible
    When user chooses 4 validation filters
    Then he can only see 3 right away

  @smoke
  @core
  Scenario: Show the view of all validation filters
    When user chooses 4 validation filters
    And clicks on the button next to them
    Then he can see the remaining filter

  @smoke
  @core
  Scenario: Hide the menu of all chosen filters for valdiation
    When user chooses 4 validation filters
    And makes them all visible
    When user clicks on "Show Less"
    Then he can see only 3 filters
