@istio-config-type-filters
@smoke
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Istio Config page

  On the Istio Config page, an admin should be able to choose all of the filters present.
  The admin should also be able close a single filter either with it's cross, or with the Close All feature.

  Background:
    Given user is at administrator perspective
    And user is at the "istio" page
    And user selects the "istio-system" namespace
    And user filters by "Type"
    And no filters are active

  Scenario: Fill the input form with nonsense
    When user types "foo bar" into the input
    Then the "No results found" phrase is displayed
    And no filters are active

  Scenario: Filters should be available in the dropdown
    When user expands the "Filter by Type" dropdown
    Then user can see the filter options

  Scenario: Single filter should be usable
    When chosen from the "Filter by Type" dropdown
    Then the filter is applied

  Scenario: Multiple filters should be usable
    When multiple filters are chosen
    Then multiple filters are active

  Scenario: Filter AuthorizationPolicy should be deletable
    When a type filter "AuthorizationPolicy" is applied
    And user clicks the cross next to the "AuthorizationPolicy"
    Then the filter is no longer active

  Scenario: Deleting all filters at once in config
    When a type filter "AuthorizationPolicy" is applied
    And user clicks on "Clear all filters"
    Then the filter is no longer active

  Scenario: When 4 or more filters are chosen, only 3 are visible right away
    When user chooses 4 type filters
    Then he can only see 3 right away

  Scenario: Show the view of all type filters
    When user chooses 4 type filters
    And clicks on the button next to them
    Then he can see the remaining filter

  Scenario: Hide the menu of all chosen filters
    When user chooses 4 type filters
    And makes them all visible
    When user clicks on "Show Less"
    Then he can see only 3 filters
