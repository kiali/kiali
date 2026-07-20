@istio-config-editor
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Istio Config editor page

  These tests are realted to Istio Config edior.

  Background:
    Given user is at administrator perspective
    And user is at the "istio" page
    And user selects the "bookinfo" namespace

  @bookinfo-app
  @core-caching
  Scenario: Filter Istio Config editor objects by Valid configuration
    When the user filters by "Config" for "Valid"
    And user sees "bookinfo-gateway"
    And user sees "bookinfo"
    And user clicks in "Name" column on the "bookinfo" text
    Then user can see istio config editor
    But no cluster badge for the "Istio config" should be visible

  @bookinfo-app
  @core-2
  Scenario: Unsaved YAML edits show reload confirmation
    When user clicks in "Name" column on the "bookinfo" text
    And user can see istio config editor
    And user edits the Istio config YAML
    And user clicks the Istio config Reload button
    Then user sees the unsaved changes modal for "Reload"
    When user cancels the unsaved changes modal
    Then user does not see the unsaved changes modal
    And user can see istio config editor

  @bookinfo-app
  @core-2
  Scenario: Unsaved YAML edits show leave confirmation on Cancel
    When user clicks in "Name" column on the "bookinfo" text
    And user can see istio config editor
    And user edits the Istio config YAML
    And user clicks the Istio config Cancel button
    Then user sees the unsaved changes modal for "Leave"
    When user cancels the unsaved changes modal
    Then user does not see the unsaved changes modal
    And user can see istio config editor
