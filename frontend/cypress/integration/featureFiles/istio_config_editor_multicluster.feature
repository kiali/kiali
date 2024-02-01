@istio-config-editor-multi-cluster
@multi-cluster
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Istio Config editor page for Multi-cluster deployment

  These tests are realted to Istio Config edior.

  Background:
    Given user is at administrator perspective
    
  Scenario: Edit an Istio object in a local cluster
    Given a "east-auth-pol" AuthorizationPolicy in the "bookinfo" namespace in the "east" cluster
    And user is at the "istio" page
    And user selects the "bookinfo" namespace
    And user clicks in "Name" column on the "east-auth-pol" text
    Then user can see istio config editor
    When user updates the "east-auth-pol" AuthorizationPolicy using the text field
    Then the "east-auth-pol" configuration should be updated

  Scenario: Delete an Istio object in a local cluster
    Given a "east-auth-pol" AuthorizationPolicy in the "bookinfo" namespace in the "east" cluster
    And user is at the "istio" page
    And user selects the "bookinfo" namespace
    And user clicks in "Name" column on the "east-auth-pol" text
    Then user can see istio config editor
    When user chooses to delete the object
    Then the "east-auth-pol" "AuthorizationPolicy" for "east" cluster "bookinfo" namespace should not exist in the table

  @multi-primary
  Scenario: Edit an Istio object in a remote cluster
    Given a "west-auth-pol" AuthorizationPolicy in the "bookinfo" namespace in the "west" cluster
    And user is at the "istio" page
    And user selects the "bookinfo" namespace
    And user clicks in "Name" column on the "west-auth-pol" text
    Then user can see istio config editor
    When user updates the "west-auth-pol" AuthorizationPolicy using the text field
    Then the "west-auth-pol" configuration should be updated

  @multi-primary
  Scenario: Delete an Istio object in a remote cluster
    Given a "west-auth-pol" AuthorizationPolicy in the "bookinfo" namespace in the "west" cluster
    And user is at the "istio" page
    And user selects the "bookinfo" namespace
    And user clicks in "Name" column on the "west-auth-pol" text
    Then user can see istio config editor
    When user chooses to delete the object
    Then the "west-auth-pol" "AuthorizationPolicy" for "west" cluster "bookinfo" namespace should not exist in the table
