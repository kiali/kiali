@traffic-policies-multi-cluster
@multi-cluster
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Manipulate Traffic Policies in the Primary-Remote and Multi-Primary setup
  In Primary-Remote setup, user should be able to create, update and delete policies on the local cluster only.
  In Multi-Primary setup, user should be able to create, update and delete policies on both clusters. 

	Background:
		Given user is at administrator perspective

  Scenario: Create a Traffic Policy in a local cluster
    When user deletes a Traffic Policy and the resource is no longer available in any cluster
    And user is at the "overview" page
    And user decides to "create" a Traffic Policy in the "east" "bookinfo"
    And user confirms to "create" the Traffic Policy
    Then an info message "Traffic policies created for bookinfo namespace." is displayed
    When user is at the "istio" list page
    And user selects the "bookinfo" namespace
    Then user sees the generated Traffic policy objects located in the "east" cluster
    And user should not see the generated Traffic policy objects located in the "west" cluster

  Scenario: Update a Traffic Policy scenario in a local cluster
    When user is at the "overview" page
    And user decides to "update" a Traffic Policy in the "east" "bookinfo"
    And user confirms to "update" the Traffic Policy
    Then an info message "Traffic policies updated for bookinfo namespace." is displayed

  Scenario: Delete the Traffic Policy scenario in a local cluster
    When user is at the "overview" page
    And user decides to "delete" a Traffic Policy in the "east" "bookinfo"
    And user confirms to "delete" the Traffic Policy
    Then an info message "Traffic policies deleted for bookinfo namespace." is displayed
    When user is at the "istio" list page
    And user selects the "bookinfo" namespace
    Then user should not see the generated Traffic policy objects located in the "east" cluster

  Scenario: Try to create a Traffic Policy in a remote cluster in the Primary-Remote deployment
    When user deletes a Traffic Policy and the resource is no longer available in any cluster
    And user is at the "overview" page
    And user decides to "create" a Traffic Policy in the "west" "bookinfo"
    And user confirms to "create" the Traffic Policy
    Then an error message "Could not create traffic policies." is displayed
    And user is at the "istio" list page
    And user selects the "bookinfo" namespace
    And user should not see the generated Traffic policy objects located in the "east" cluster
    And user should not see the generated Traffic policy objects located in the "west" cluster

  @multi-primary
  Scenario: Create a Traffic Policy in a remote cluster
    When user deletes a Traffic Policy and the resource is no longer available in any cluster
    And user is at the "overview" page
    And user decides to "create" a Traffic Policy in the "west" "bookinfo"
    And user confirms to "create" the Traffic Policy
    Then an info message "Traffic policies created for bookinfo namespace." is displayed
    When user is at the "istio" list page
    And user selects the "bookinfo" namespace
    Then user sees the generated Traffic policy objects located in the "west" cluster
    And user should not see the generated Traffic policy objects located in the "east" cluster

  @multi-primary
  Scenario: Update a Traffic Policy scenario in a remote cluster
    When user is at the "overview" page
    And user decides to "update" a Traffic Policy in the "west" "bookinfo"
    And user confirms to "update" the Traffic Policy
    Then an info message "Traffic policies updated for bookinfo namespace." is displayed

  @multi-primary
  Scenario: Delete the Traffic Policy scenario in a remote cluster
    When user is at the "overview" page
    And user decides to "delete" a Traffic Policy in the "west" "bookinfo"
    And user confirms to "delete" the Traffic Policy
    Then an info message "Traffic policies deleted for bookinfo namespace." is displayed
    When user is at the "istio" list page
    And user selects the "bookinfo" namespace
    Then user should not see the generated Traffic policy objects located in the "west" cluster
