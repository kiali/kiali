@app-details-multi-cluster
# don't change first line of this file - the tag is used for the test scripts to identify the test suite
@multi-cluster
@skip
Feature: Kiali App Details page for multicluster

  On the App Details page, an admin should see details about an application along with a cluster badge as well as
  a minigraph for traffic going to and originating from the application. We should also be able to navigate to a
  a remote cluster, if an app of one is present on the graph.
  In addition, there should be tabs for viewing application specific traffic, including a new cluster.

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

  # Jaeger is not available in OCP 4.19, and we don't have Tempo setup yet in LPINTEROP pipelines (will be for OSSM3+)
  @skip-lpinterop
  @app-details-page
  Scenario: See span info after selecting app span
    And user is at the details page for the "app" "bookinfo/productpage" located in the "west" cluster
    And user sees trace information
    When user selects a trace
    Then user sees span details
    And user can filter spans by app

  @app-details-page
  Scenario Outline: User should be able to navigate through the graph to remotely located apps, services and workloads
    When user is at the details page for the "app" "bookinfo/productpage" located in the "east" cluster
    And user clicks on the "reviews" <type> from the "west" cluster visible in the graph
    Then user is at the details page for the <type> <url> located in the "west" cluster

    Examples:
      | <type>   | <url>               |
      | app      | bookinfo/reviews    |
      | service  | bookinfo/reviews    |
      | workload | bookinfo/reviews-v3 |
