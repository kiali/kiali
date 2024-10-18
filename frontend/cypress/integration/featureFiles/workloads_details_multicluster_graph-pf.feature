@workloads-details-multi-cluster-graph
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

@multi-cluster
Feature: Kiali Workloads Details minigraph in multicluster setup

  Scenario: See minigraph for workload.
    Given user is at administrator perspective
    And user is at the details page for the "workload" "bookinfo/reviews-v2" located in the "west" cluster
    Then user sees a minigraph
    And user sees "service" from a remote "west" cluster in the minigraph

  Scenario: Minigraph should not be visible for a service, which is not deployed in specific cluster.
    Given user is at administrator perspective
    And user is at the details page for the "workload" "bookinfo/details-v1" located in the "west" cluster
    Then user does not see a minigraph

  Scenario Outline: User should be able to navigate through the graph to remote workloads and services.
    Given user is at administrator perspective
    Given user is at the details page for the "workload" "bookinfo/productpage-v1" located in the "east" cluster
    And the "<name>" "<type>" from the "west" cluster is visible in the minigraph
    When user clicks on the "<name>" "<type>" from the "west" cluster in the minigraph
    Then the browser is at the details page for the "<type>" "bookinfo/<name>" located in the "west" cluster

    Examples:
      | type     | name       |
      | service  | reviews    |

  # TODO Fix issue https://github.com/kiali/kiali/issues/7839
  #   | workload | reviews-v3 |

  # This is a regression test for this bug (https://github.com/kiali/kiali/issues/6185)
  # This is only multi-primary because that is the suite that has openid setup.
  @multi-primary
  Scenario: Remote nodes should be restricted if user does not have access rights to a remote namespace
    Given user is at limited user perspective
    When user is at the details page for the "workload" "bookinfo/productpage-v1" located in the "east" cluster
    Then the nodes on the minigraph located in the "west" cluster should be restricted
