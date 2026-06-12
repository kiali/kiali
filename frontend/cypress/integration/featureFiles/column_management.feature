@column-management
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Column Management in List Pages

  Users should be able to manage (show/hide/reorder) columns in Apps, Services, and Workloads list pages.
  The Name column should always remain visible and cannot be hidden.

  Background:
    Given user is at administrator perspective

  @bookinfo-app
  @core-1
  @offline
  Scenario: Apps list - Open column management modal
    Given user is at the "applications" list page
    And user selects the "bookinfo" namespace
    When user clicks the "Manage columns" button with test id "apps-manage-columns"
    Then the column management modal should be visible
    And the modal title should be "Manage columns"

  @bookinfo-app
  @core-1
  @offline
  Scenario: Apps list - Name column is not hideable in modal
    Given user is at the "applications" list page
    And user selects the "bookinfo" namespace
    When user clicks the "Manage columns" button with test id "apps-manage-columns"
    Then the "Name" column checkbox should be disabled in the modal
    And the "Name" column should be checked in the modal

  @bookinfo-app
  @core-1
  @offline
  Scenario: Apps list - Hide and show columns via modal
    Given user is at the "applications" list page
    And user selects the "bookinfo" namespace
    When user clicks the "Manage columns" button with test id "apps-manage-columns"
    And user unchecks the "Labels" column in the modal
    And user unchecks the "Details" column in the modal
    And user applies the column changes
    Then the "Labels" column should not be visible in the table
    And the "Details" column should not be visible in the table
    And the "Name" column should be visible in the table
    When user clicks the "Manage columns" button with test id "apps-manage-columns"
    And user checks the "Labels" column in the modal
    And user applies the column changes
    Then the "Labels" column should be visible in the table

  @bookinfo-app
  @core-1
  @offline
  Scenario: Apps list - Reorder columns via modal
    Given user is at the "applications" list page
    And user selects the "bookinfo" namespace
    When user clicks the "Manage columns" button with test id "apps-manage-columns"
    And user reorders columns in the modal
    Then the columns should be in the new order

  @bookinfo-app
  @core-1
  @offline
  Scenario: Apps list - Reset columns to default
    Given user is at the "applications" list page
    And user selects the "bookinfo" namespace
    When user clicks the "Manage columns" button with test id "apps-manage-columns"
    And user unchecks the "Health" column in the modal
    And user applies the column changes
    Then the "Health" column should not be visible in the table
    When user clicks the "Manage columns" button with test id "apps-manage-columns"
    And user resets columns to default
    Then all default columns should be visible
    And the "Health" column should be visible in the table

  @bookinfo-app
  @core-1
  @offline
  Scenario: Apps list - Name column cannot be hidden via URL
    Given user is at the "applications" list page with URL param "apphide=name,health,labels"
    And user selects the "bookinfo" namespace
    Then the "Name" column should be visible in the table
    And the "Health" column should not be visible in the table
    And the "Labels" column should not be visible in the table

  @bookinfo-app
  @core-1
  @offline
  Scenario: Apps list - Column state persists in URL
    Given user is at the "applications" list page
    And user selects the "bookinfo" namespace
    When user clicks the "Manage columns" button with test id "apps-manage-columns"
    And user unchecks the "Namespace" column in the modal
    And user applies the column changes
    Then the URL should contain "apphide"
    And the URL should contain "namespace"
    When user refreshes the page
    Then the "Namespace" column should not be visible in the table

  @bookinfo-app
  @core-1
  @offline
  Scenario: Services list - Name column is not hideable
    Given user is at the "services" list page
    And user selects the "bookinfo" namespace
    When user clicks the "Manage columns" button with test id "services-manage-columns"
    Then the "Name" column checkbox should be disabled in the modal
    When user closes the column management modal
    And user visits the page with URL param "svchide=name,health"
    Then the "Name" column should be visible in the table
    And the "Health" column should not be visible in the table

  @bookinfo-app
  @core-1
  @offline
  Scenario: Workloads list - Name column is not hideable
    Given user is at the "workloads" list page
    And user selects the "bookinfo" namespace
    When user clicks the "Manage columns" button with test id "workloads-manage-columns"
    Then the "Name" column checkbox should be disabled in the modal
    When user closes the column management modal
    And user visits the page with URL param "wlhide=name,health"
    Then the "Name" column should be visible in the table
    And the "Health" column should not be visible in the table

  @bookinfo-app
  @core-1
  @offline
  Scenario: Apps list - Column order persists in URL
    Given user is at the "applications" list page
    And user selects the "bookinfo" namespace
    When user clicks the "Manage columns" button with test id "apps-manage-columns"
    And user reorders columns in the modal
    Then the URL should contain "apporder"
    When user refreshes the page
    Then the columns should maintain the custom order
