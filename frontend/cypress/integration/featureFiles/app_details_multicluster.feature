@app-details-multi-cluster
# don't change first line of this file - the tag is used for the test scripts to identify the test suite
@multi-cluster
Feature: Kiali App Details page for multicluster

  On the App Details page, an admin should see details about an application along with a cluster badge as well as
  a minigraph for traffic going to and originating from the application.
  In addition, there should be tabs for viewing application specific traffic, including a new cluster.

  Background:
    Given user is at administrator perspective
    And user is at the details page for the "app" "bookinfo/reviews" located in the "west" cluster

  @skip
  Scenario: See details for app.
    Then user sees details information for the remote "reviews" app
    And the description card should contain a reference to workload
    And the description card should contain a reference to service
    And links in the description card should contain a reference to a "west" cluster
    And cluster badge for "west" cluster should be visible

  Scenario: See app minigraph for details app.
    Then user sees a minigraph
    And user sees "app" from a remote "west" cluster

  Scenario: See app Traffic information
    Then user sees inbound and outbound traffic information
    And user should see columns related to cluster info for the inbound and outbound traffic

  Scenario: See Inbound Metrics
    Then user sees inbound metrics information

  Scenario: See Outbound Metrics
    Then user sees outbound metrics information

  Scenario: See tracing info after selecting a trace
    And user sees trace information
    And user sees tracing warning
    When user selects a trace
    Then user sees trace details

  Scenario: See span info after selecting app span
    And user sees trace information
    When user selects a trace
    Then user sees span details
    And user can filter spans by app
