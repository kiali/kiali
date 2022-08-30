@istio-page
Feature: Kiali Istio Config page

  On the Istio Config page, an admin should be able to choose all of the filters present. 
  The admin should also be able close a single filter either with it's cross, or with the Close All feature.

  Background:
    Given user is at administrator perspective
    And user is at the "istio" page
    And user selects the "istio-system" namespace
    And user filters by "Config" 
    And no filters are active

  Scenario Outline: All of the filters should be available for turning on
    When user filters by "<category>" option
    Then user can see only the "<category>"  
    Examples:
    | category |
    | Valid |
    | Warning |
    | Not Valid |
    | Not Validated |

Scenario Outline: All of the filters can be turned off with their cross
    When a validation filter "<category>" is applied
    And user clicks the cross next to the "<category>" 
    Then the validation filter "<category>" is no longer active  
    Examples:
    | category |
    | Valid |
    | Warning |
    | Not Valid |
    | Not Validated |

Scenario Outline: Filter cannot be selected twice
  When a validation filter "<category>" is applied  
  And the "<category>" validation filter is applied again
  Then the filter "<category>" should be visible only once
  Examples:
    | category |
    | Valid |
    | Warning |
    | Not Valid |
    | Not Validated |

Scenario: Deleting a single filter should not delete more filters
  When user chooses 3 validation filters
  And user clicks the cross on one of them
  Then 2 filters should be visible

Scenario: When 4 or more filters are chosen, only 3 are visible right away
  When user chooses 4 validation filters
  Then he can only see 3 right away
  
Scenario: Show the view of all chosen filters
  When user chooses 4 validation filters
  And clicks on the button next to them
  Then he can see the remaining filter

Scenario: Hide the menu of all chosen filters 
  When user chooses 4 validation filters
  And makes them all visible
  When user clicks on "Show Less"
  Then he can see only 3 filters

Scenario: Deleting all filters at once
  When user chooses 4 validation filters
  And user clicks on "Clear all filters"
  Then no filters are active
