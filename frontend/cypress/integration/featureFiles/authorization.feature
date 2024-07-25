@authorization
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Authorization

  User opens the Overview page.

  Background:
    Given user is at limited user perspective
    And user is at the "overview" page

  @multi-cluster
  @multi-primary
  @authorization
  Scenario: There should be one bookinfo namespace card
    Then user sees the "bookinfo" namespace card in cluster "east"
    Then user doesn't see the "istio-system" namespace card
    Then user doesn't see the "mesh" menu

  @multi-cluster
  @multi-primary
  @authorization
  Scenario: No Mesh Link in the Kiali about page

    And user clicks on Help Button
    And user clicks on About Button
    Then user does not see the "mesh" link
