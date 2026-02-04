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
    Then user sees the "bookinfo" namespace in the namespaces page
    And the "Cluster" column "disappears"
    And user sees a table with headings
      | Namespace | Type | Health | mTLS | Istio config | Labels |
    And the "Namespace" column on the "bookinfo" row has the text "bookinfo"

  @core-2
  Scenario: See namespaces table with correct info
    Then user sees the "bookinfo" namespace in the namespaces page
    And user sees a table with headings
      | Namespace | Type | Health | mTLS | Istio config | Labels |
    And the "Namespace" column on the "bookinfo" row has the text "bookinfo"
    And the "Type" column on the "bookinfo" row is not empty
    And the health column on the "bookinfo" row has a health icon
    And the "mTLS" column on the "bookinfo" row has the text "Unset"
    And the "Istio config" column on the "bookinfo" row is not empty
    And the "Labels" column on the "bookinfo" row is not empty

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

  @core-2
  @offline
  Scenario: Filter namespaces by name
    When user selects filter "Namespace"
    And user filters for name "alpha"
    Then user sees the "alpha" namespace in the namespaces page
    And table length should be 1

  @core-2
  @offline
  Scenario: Filter namespaces by type
    When user selects filter "Type"
    And user filters for type "Control plane"
    Then user sees the "istio-system" namespace in the namespaces page
    And table length should be 1

  @core-2
  @offline
  Scenario: Sort namespaces by name
    When user sorts the list by column "Namespace" in "ascending" order
    Then the list is sorted by column "Namespace" in "ascending" order
    When user sorts the list by column "Namespace" in "descending" order
    Then the list is sorted by column "Namespace" in "descending" order

