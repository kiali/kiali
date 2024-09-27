@app-details-multi-cluster
# don't change first line of this file - the tag is used for the test scripts to identify the test suite
@multi-cluster
@pft
Feature: Kiali App Details page minigraph in multicluster setup

  Some App Details minigraph tests, which required a different setup.
  Minigraph should not be displayed for an app, if it is not present in the cluster.
  We should also be able to navigate to a remote cluster, if an app of one is present on the graph.

  Scenario: See app minigraph for details app.
    Given user is at administrator perspective
    And user is at the details page for the "app" "bookinfo/reviews" located in the "east" cluster
    Then user sees a patternfly minigraph
    And user sees "app" from a remote "west" cluster in the patternfly minigraph

  Scenario: Minigraph should not be visible for app, which is not deployed in specific cluster.
    Given user is at administrator perspective
    And user is at the details page for the "app" "bookinfo/details" located in the "west" cluster
    Then user does not see a minigraph

  Scenario Outline: User should be able to navigate through the graph to remotely located apps, services and workloads
    Given user is at administrator perspective
    Given user is at the details page for the "app" "bookinfo/productpage" located in the "east" cluster
    And the "<name>" "<type>" from the "west" cluster is visible in the patternfly minigraph
    When user clicks on the "<name>" "<type>" from the "west" cluster in the patternfly graph
    Then the browser is at the details page for the "<type>" "bookinfo/<name>" located in the "west" cluster

    Examples:
      | type     | name       |
      | app      | reviews    |
      | service  | reviews    |
      | workload | reviews-v3 |

  # This is a regression test for this bug (https://github.com/kiali/kiali/issues/6185)
  # This is only multi-primary because that is the suite that has openid setup.
  @multi-primary
  Scenario: Remote nodes should be restricted if user does not have access rights to a remote namespace
    Given user is at limited user perspective
    When user is at the details page for the "app" "bookinfo/productpage" located in the "east" cluster
    Then the nodes on the patternfly minigraph located in the "west" cluster should be restricted
