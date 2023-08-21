@multi-cluster
@to-be-implemented
Feature: Kiali App Details page for multicluster

  On the App Details page, an admin should see details about an application along with a cluster badge as well as
  a minigraph for traffic going to and originating from the application. We should also be able to navigate to a
  a remote cluster, if an app of one is present on the graph. 
  In addition, there should be tabs for viewing application specific traffic, including a new cluster.
  #  column inbound/outbound metrics,
  # and traces. The traces tab should show trace details about the selected trace. The spans tab
  # should show span details about the selected trace.

  Background:
    Given user is at administrator perspective

  @app-details-page
  Scenario: See details for app.
    And user is at the details page for the "app" "bookinfo/reviews" located in the "west" cluster
    Then user sees details information for the remote "reviews" app
    And cluster badge for "west" cluster should be visible

  @app-details-page
  Scenario: See app minigraph for details app.
    And user is at the details page for the "app" "bookinfo/productpage" located in the "west" cluster
    Then user sees a minigraph
    And user sees "app" from a remote "west" cluster

  @app-details-page
  Scenario: See app Traffic information
    And user is at the details page for the "app" "bookinfo/productpage" located in the "west" cluster
    Then user sees inbound and outbound traffic information
    And user should see columns related to cluster info for the inbound and outbound traffic

  @app-details-page
  Scenario: See Inbound Metrics
    And user is at the details page for the "app" "bookinfo/reviews" located in the "west" cluster
    Then user sees inbound metrics information

  @app-details-page
  Scenario: See Outbound Metrics
    And user is at the details page for the "app" "bookinfo/reviews" located in the "west" cluster
    Then user sees outbound metrics information

  @app-details-page
  Scenario: See tracing info after selecting a trace
    And user is at the details page for the "app" "bookinfo/productpage" located in the "west" cluster
    And user sees trace information
    When user selects a trace
    Then user sees trace details

  @app-details-page
  Scenario: See span info after selecting app span
    And user is at the details page for the "app" "bookinfo/productpage" located in the "west" cluster
    And user sees trace information
    When user selects a trace
    Then user sees span details
    And user can filter spans by app
