@multi-cluster
@skip
@workloads-details
Feature: Kiali Workloads Details page for multicluster

  Scenario Outline: User should be able to navigate through the graph to remote workloads and services.
    When user is at the details page for the "app" "bookinfo/productpage" located in the "east" cluster
    And user clicks on the "reviews" <type> from the "west" cluster visible in the graph
    Then user is at the details page for the <type> <url> located in the "west" cluster

  Examples: 
    | <type> | <url> |
    | service | bookinfo/reviews |
    | workload | bookinfo/reviews-v3 |
