@overview
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Manual Refresh option

  Start on the Overview page, set the refresh interval to 'Manual', and then ensure all of the pages
  initially show the "Maunual refresh needed" message. Note that the Istio Config page is the only
  page without refresh interval, and is not tested.

  Background:
    Given user is at administrator perspective

  @ossmc
  @base
  Scenario: Overview page shows manual
    When user is at the "overview" page with manual refresh
    Then user "sees" manual refresh messaging

  @ossmc
  @base
  Scenario: Graph page shows manual
    When user is at the "graph" page with manual refresh
    Then user "sees" manual refresh messaging

  @base
  Scenario: Applications page shows manual
    When user is at the "applications" page with manual refresh
    Then user "sees" manual refresh messaging

  @base
  Scenario: Services page shows manual
    When user is at the "services" page with manual refresh
    Then user "sees" manual refresh messaging

  @base
  Scenario: Workloads page shows manual
    When user is at the "workloads" page with manual refresh
    Then user "sees" manual refresh messaging

  @base
  Scenario: Istio page does not show manual
    When user is at the "istio" page with manual refresh
    Then user "does not see" manual refresh messaging

  @ossmc
  @base
  Scenario: Mesh page shows manual
    When user is at the "mesh" page with manual refresh
    Then user "sees" manual refresh messaging

