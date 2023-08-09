@multi-cluster
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
    And user is at the details page for the "app" "bookinfo/productpage"

  @app-details-page
  Scenario: See details for app.
    Then user sees details information for the "productpage" app
    And cluster badge for "east" cluster should be visible

  @app-details-page
  Scenario: See app minigraph for details app.
    Then user sees a minigraph
    And user sees "app" from a remote "west" cluster

  @app-details-page
  Scenario: See app Traffic information
    Then user sees inbound and outbound traffic information
    And user should see a column related to cluster info
