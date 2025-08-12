@sidebar-toggle
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

@smoke
Feature: Sidebar toggle

  User opens the Overview page and toggles the main sidebar.

  Background:
    Given user is at administrator perspective
    And user is at the "overview" page

  Scenario: Close the sidebar
    When the sidebar is open
    And user presses the navigation toggle button
    Then user cannot see the sidebar

  @core
  Scenario: Open the sidebar
    When the sidebar is closed
    And user presses the navigation toggle button
    Then user sees the sidebar
