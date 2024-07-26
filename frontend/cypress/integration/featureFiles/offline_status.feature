@offline
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali offline mode status

  User wants to verify that the offline status indicator is displayed when Kiali is running in offline mode.

  Background:
    Given user is at administrator perspective

  Scenario: Offline status icon is visible in offline mode
    Given user is at the "overview" page
    Then user sees the offline status icon

  Scenario: Minigraph displays offline on workload details page
    Given user is at the details page for the "workload" "bookinfo/details-v1" located in the "" cluster
    Then user sees the minigraph displays offline
