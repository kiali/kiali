@namespaces
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Namespaces page

  User opens the Namespaces page and sees namespaces in a list.

  Background:
    Given user is at administrator perspective
    And user is at the "namespaces" list page

  @core-2
  @offline
  @lpinterop
  Scenario: Cluster column is hidden on single-cluster namespaces list
    Then user sees the "beta" namespace in the namespaces page
    And the "Cluster" column "disappears"

  @multi-cluster
  Scenario: Cluster column is visible on multi-cluster namespaces list
    Then user sees the "bookinfo" namespace in the namespaces page
    And the "Cluster" column "appears"
    And cluster badges for "east" and "west" cluster are visible in the namespaces page

  @multi-cluster
  Scenario: Cluster column is visible and sortable on multi-cluster namespaces list
    Then the "Cluster" column "appears"
    And user sorts the list by column "Cluster" in "descending" order
    Then the list is sorted by column "Cluster" in "descending" order

  @ambient
  Scenario: Ambient badge is visible on namespaces list
    Then user sees the "istio-system" namespace in the namespaces page
    And badge for "Ambient" is visible in the namespaces page in the namespace "istio-system"

