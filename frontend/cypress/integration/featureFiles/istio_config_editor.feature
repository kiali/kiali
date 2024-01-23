@istio-config-editor
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Istio Config editor page

  This tests are realted to Istio Config edior.

  Background:
    Given user is at administrator perspective
    And user is at the "istio" page
    And user selects the "bookinfo" namespace

  @bookinfo-app
  Scenario: Filter Istio Config editor objects by Valid configuration
    When the user filters by "Config" for "Valid"
    And user sees "bookinfo-gateway"
    And user sees "bookinfo"
    And user clicks in "Name" column on the "bookinfo" text
    Then user can see istio config editor
    But no cluster badge for the "Istio config" should be visible

  @multi-cluster
  Scenario: Filter Istio Config editor objects by Valid configuration
    When the user filters by "Config" for "Valid"
    And user sees "bookinfo-gateway"
    And user sees "bookinfo"
    And user clicks in "Name" column on the "bookinfo" text
    Then user can see istio config editor
    And cluster badge for "east" cluster should be visible in the Istio config side panel

  @multi-cluster
  Scenario: Edit an Istio object in a local cluster
    Given a "east-auth-pol" AuthorizationPolicy in the "bookinfo" namespace in the "east" cluster
    And user clicks in "Name" column on the "east-auth-pol" text
    Then user can see istio config editor
    When user updates the configuration in the text field
    And user previews the configuration
    And user updates the configuration
    Then the configuration should be updated

  @multi-cluster
  Scenario: Delete an Istio object in a local cluster
    Given a "east-auth-pol" AuthorizationPolicy in the "bookinfo" namespace in the "east" cluster
    And user clicks in "Name" column on the "east-auth-pol" text
    Then user can see istio config editor
    When user chooses to delete the object
    Then the "east-auth-pol" row for "east" cluster should not exist in the table

  @multi-cluster
  @multi-primary
  Scenario: Edit an Istio object in a remote cluster
    Given a "west-auth-pol" AuthorizationPolicy in the "bookinfo" namespace in the "west" cluster
    And user clicks in "Name" column on the "west-auth-pol" text
    Then user can see istio config editor
    When user updates the configuration in the text field
    And user previews the configuration
    And user updates the configuration
    Then the configuration should be updated

  @multi-cluster
  @multi-primary
  Scenario: Delete an Istio object in a remote cluster
    Given a "west-auth-pol" AuthorizationPolicy in the "bookinfo" namespace in the "west" cluster
    And user clicks in "Name" column on the "west-auth-pol" text
    Then user can see istio config editor
    When user chooses to delete the object
    Then the "west-auth-pol" row for "west" cluster should not exist in the table
