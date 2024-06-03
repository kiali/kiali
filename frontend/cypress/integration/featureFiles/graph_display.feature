@graph-display
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Graph page - Display menu

  User opens the Graph page and manipulates the "error-rates" demo

  Background:
    Given user is at administrator perspective

  # NOTE: Graph Find/Hide has its own test script
  # NOTE: Operation nodes has its own test script
  # NOTE: Traffic animation, missing sidecars, virtual service, and idle edge options are nominally tested

  @error-rates-app
  Scenario: Graph no namespaces
    When user graphs "" namespaces
    Then user sees no namespace selected

  # gamma will only show nodes when idle-nodes is enabled
  @error-rates-app
  Scenario: Graph gamma namespaces
    When user graphs "gamma" namespaces
    Then user sees empty graph

  @error-rates-app
  Scenario: User enables idle nodes
    When user opens display menu
    And user "enables" "idle nodes" option
    Then user sees the "gamma" namespace
    And idle nodes "appear" in the graph

  @error-rates-app
  Scenario: User disables idle nodes
    When user "disables" "idle nodes" option
    Then user sees empty graph

  @error-rates-app
  Scenario: Graph alpha and beta namespaces
    When user graphs "alpha,beta" namespaces
    Then user sees the "alpha" namespace
    And user sees the "beta" namespace

  @error-rates-app
  Scenario: User clicks Display Menu
    When user opens display menu
    Then the display menu opens
    And the display menu has default settings
    And the graph reflects default settings

  # percentile variable must match input id
  # edge label variable must match edge data name
  @error-rates-app
  Scenario: Average Response-time edge labels
    When user enables "avg" "responseTime" edge labels
    Then user sees "responseTime" edge labels

  # percentile variable must match input id
  # edge label variable must match edge data name
  @error-rates-app
  Scenario: Median Response-time edge labels
    When user enables "rt50" "responseTime" edge labels
    Then user sees "responseTime" edge labels

  # percentile variable must match input id
  # edge label variable must match edge data name
  @error-rates-app
  Scenario: 95th Percentile Response-time edge labels
    When user enables "rt95" "responseTime" edge labels
    Then user sees "responseTime" edge labels

  # percentile variable must match input id
  # edge label variable must match edge data name
  @error-rates-app
  Scenario: 99th Percentile Response-time edge labels
    When user enables "rt99" "responseTime" edge labels
    Then user sees "responseTime" edge labels

  # edge label variable must match edge data name
  @error-rates-app
  Scenario: Disable response time edge labels
    When user "disables" "responseTime" edge labels
    Then user sees "responseTime" edge label option is closed

  # percentile variable must match input id
  # edge label variable must match edge data name
  @error-rates-app
  Scenario: Request Throughput edge labels
    When user enables "throughputRequest" "throughput" edge labels
    Then user sees "throughput" edge labels

  # percentile variable must match input id
  # edge label variable must match edge data name
  @error-rates-app
  Scenario: Response Throughput edge labels
    When user enables "throughputResponse" "throughput" edge labels
    Then user sees "throughput" edge labels

  # edge label variable must match edge data name
  @error-rates-app
  Scenario: Disable throughput edge labels
    When user "disables" "throughput" edge labels
    Then user sees "throughput" edge label option is closed

  # edge label variable must match edge data name
  @error-rates-app
  Scenario: Enable Traffic Distribution edge labels
    When user "enables" "trafficDistribution" edge labels
    Then user sees "trafficDistribution" edge labels

  # edge label variable must match edge data name
  @error-rates-app
  Scenario: Disable Traffic Distribution edge labels
    When user "disables" "trafficDistribution" edge labels
    Then user sees "trafficDistribution" edge label option is closed

  # edge label variable must match edge data name
  @error-rates-app
  Scenario: Enable Traffic Rate edge labels
    When user "enables" "trafficRate" edge labels
    Then user sees "trafficRate" edge labels

  # edge label variable must match edge data name
  @error-rates-app
  Scenario: Disable Traffic Rate edge labels
    When user "disables" "trafficRate" edge labels
    Then user sees "trafficRate" edge label option is closed

  @error-rates-app
  Scenario: User disables cluster boxes
    When user "disables" "cluster boxes" option
    Then user does not see "Cluster" boxing

  @error-rates-app
  Scenario: User disables Namespace boxes
    When user "disables" "namespace boxes" option
    Then user does not see "Namespace" boxing

  @error-rates-app
  Scenario: User enables idle edges
    When user "enables" "idle edges" option
    Then idle edges "appear" in the graph

  @error-rates-app
  Scenario: User disables idle edges
    When user "disables" "idle edges" option
    Then idle edges "do not appear" in the graph

  @error-rates-app
  Scenario: User enables rank
    When user "enables" "rank" option
    Then ranks "appear" in the graph

  @error-rates-app
  Scenario: User disables rank
    When user "disables" "rank" option
    Then ranks "do not appear" in the graph

  @error-rates-app
  Scenario: User disables service nodes
    When user "disables" "service nodes" option
    Then user does not see service nodes

  @error-rates-app
  Scenario: User enables security
    When user "enables" "security" option
    Then security "appears" in the graph

  @error-rates-app
  Scenario: User disables security
    When user "disables" "security" option
    Then security "does not appear" in the graph

  @error-rates-app
  Scenario: User disables missing sidecars
    When user "disables" "missing sidecars" option
    Then "missing sidecars" option "does not appear" in the graph

  @error-rates-app
  Scenario: User disables virtual services
    When user "disables" "virtual services" option
    Then "virtual services" option "does not appear" in the graph

  @error-rates-app
  Scenario: User enables animation
    When user "enables" "traffic animation" option
    Then "traffic animation" option "appears" in the graph

  @error-rates-app
  Scenario: User disables animation
    When user "disables" "traffic animation" option
    Then "traffic animation" option "does not appear" in the graph

  @error-rates-app
  Scenario: User resets to factory default setting
    When user resets to factory default
    And user opens display menu
    Then the display menu opens
    And the display menu has default settings

  @error-rates-app
  Scenario: User observes some options not being clickable when switching to Service graph
    When user "disables" "service nodes" option
    And user "enables" "operation nodes" option
    And user selects "SERVICE" graph type
    And user opens display menu
    Then the display menu opens
    And the "service nodes" option should "not be checked" and "disabled"
    And the "operation nodes" option should "be checked" and "disabled"
    When user selects "APP" graph type
    And user opens display menu
    Then the display menu opens
    And the "service nodes" option should "not be checked" and "enabled"
    And the "operation nodes" option should "be checked" and "enabled"

  @bookinfo-app
  Scenario Outline: Multiple cluster boxes should not be visible in the graph
    When user graphs "bookinfo" namespaces
    And user resets to factory default
    And user selects "<type>" graph type
    Then user sees the "bookinfo" namespace
    And only a single cluster box should be visible
    Examples:
      | type          |
      | APP           |
      | SERVICE       |
      | VERSIONED_APP |
      | WORKLOAD      |

  @multi-cluster
  Scenario: Graph bookinfo namespace for the multi-cluster setup
    When user graphs "bookinfo" namespaces
    Then user sees the "bookinfo" namespace
    And user sees the "bookinfo" namespace deployed across the east and west clusters
    And nodes in the "east" cluster should contain the cluster name in their links
    And nodes in the "west" cluster should contain the cluster name in their links

  @multi-cluster
  Scenario: See link to correct details page after clicking on a node for the east cluster
    Given user graphs "bookinfo" namespaces
    When user clicks on the "productpage-v1" workload in the "bookinfo" namespace in the "east" cluster
    Then user sees a link to the "east" cluster workload details page in the summary panel

  @multi-cluster
  Scenario: See link to correct details page after clicking on a node for the west cluster
    Given user graphs "bookinfo" namespaces
    When user clicks on the "reviews-v2" workload in the "bookinfo" namespace in the "west" cluster
    Then user sees a link to the "west" cluster workload details page in the summary panel

  #this is a regression to this bug (https://github.com/kiali/kiali/issues/6185)
  #I used the sleep namespace in the Gherkin, because I feel like we might need a new demoapp for this scenario,
  #if we don't want to change access to bookinfo namespace in the middle of the test run.
  # TODO: Implement: https://github.com/kiali/kiali/issues/7021
  @skip
  @multi-cluster
  Scenario: Remote nodes should be restricted if user does not have access rights to a remote namespace
    When user graphs "sleep" namespaces
    And user "is" given access rights to a "sleep" namespace located in the "east" cluster
    And user "is not" given access rights to a "sleep" namespace located in the "west" cluster
    And user is at the details page for the "app" "sleep/east" located in the "east" cluster
    Then the nodes located in the "west" cluster should be restricted

  #inspired by this: https://github.com/kiali/kiali/pull/6469
  #in order to test this properly, Istio CRDs should be enabled in west and atleast 1 Istio object should be created there
  @multi-cluster
  @multi-primary
  Scenario: See Istio config validations from both clusters
    Given there are Istio objects in the "bookinfo" namespace for "east" cluster
    And there are Istio objects in the "bookinfo" namespace for "west" cluster
    When user graphs "bookinfo" namespaces
    Then the Istio objects for the "bookinfo" namespace for both clusters should be grouped together in the panel

  @multi-cluster
  Scenario Outline: User double clicks node from specific cluster
    When user graphs "bookinfo" namespaces
    And user double-clicks on the "reviews" "<type>" from the "<cluster>" cluster in the main graph
    Then the browser is at the details page for the "<type>" "bookinfo/reviews" located in the "<cluster>" cluster

    Examples:
      | type     | cluster |
      | app      | east    |
      | app      | west    |
      | service  | east    |
      | service  | west    |

  @ambient
  Scenario: User sees tcp traffic
    When user graphs "bookinfo" namespaces
    Then user sees the "bookinfo" namespace
    Then user opens traffic menu
    And user "disables" "http" traffic option
    Then 6 edges appear in the graph

  @ambient
  Scenario: User sees http traffic
    When user graphs "bookinfo" namespaces
    Then user sees the "bookinfo" namespace
    Then user opens traffic menu
    And user "disables" "tcp" traffic option
    Then 2 edges appear in the graph
