@app-details-multi-cluster
# don't change first line of this file - the tag is used for the test scripts to identify the test suite
@multi-cluster
Feature: Kiali App Details page for multicluster

  On the App Details page, an admin should see details about an application along with a cluster badge as well as
  a minigraph for traffic going to and originating from the application.
  In addition, there should be tabs for viewing application specific traffic, including a new cluster.

  Background:
    Given user is at administrator perspective

  Scenario: See details for app.
    And user is at the details page for the "app" "bookinfo/reviews" located in the "west" cluster
    Then user sees details information for the remote "reviews" app
    And links in the "App" description card should contain a reference to a "west" cluster
    And cluster badge for "west" cluster should be visible in the "App" description card

  Scenario: See app Traffic information
    And user is at the details page for the "app" "bookinfo/reviews" located in the "west" cluster
    Then user sees inbound and outbound traffic information
    And user should see columns related to cluster info for the inbound and outbound traffic

  Scenario: See Inbound Metrics
    And user is at the details page for the "app" "bookinfo/reviews" located in the "west" cluster
    Then user sees "Inbound" metrics information for the remote "reviews" "app"

  Scenario: See Outbound Metrics
    And user is at the details page for the "app" "bookinfo/reviews" located in the "west" cluster
    Then user sees "Outbound" metrics information for the remote "reviews" "app"

  Scenario: See tracing info after selecting a trace
    And user is at the details page for the "app" "bookinfo/reviews" located in the "west" cluster
    And user sees trace information
    When user selects a trace
    Then user sees trace details

  Scenario: See span info after selecting app span
    And user is at the details page for the "app" "bookinfo/reviews" located in the "west" cluster
    And user sees trace information
    When user selects a trace
    Then user sees span details
    And user can filter spans by app "productpage"

  Scenario: Don't see tracing info after selecting a trace
    And user is at the details page for the "app" "bookinfo/details" located in the "east" cluster
    Then user see no traces

  Scenario: See details for an app, which is not deployed in the specific cluster.
    And user is at the details page for the "app" "bookinfo/ratings" located in the "east" cluster
    Then links in the "App" description card should contain a reference to a "east" cluster
    And cluster badge for "east" cluster should be visible in the "App" description card

  Scenario: See no app Traffic information for an app, which is not deployed in the specific cluster.
    And user is at the details page for the "app" "bookinfo/ratings" located in the "east" cluster
    Then user does not see any inbound and outbound traffic information

  Scenario: See no Inbound Metrics for an app, which is not deployed in the specific cluster.
    And user is at the details page for the "app" "bookinfo/ratings" located in the "east" cluster
    Then user does not see "Inbound" metrics information for the "east" "ratings" "app"

  Scenario: See no Outbound Metrics for an app, which is not deployed in the specific cluster.
    And user is at the details page for the "app" "bookinfo/ratings" located in the "east" cluster
    Then user does not see "Outbound" metrics information for the "east" "ratings" "app"
