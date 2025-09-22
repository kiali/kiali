@graph-display
@ossmc
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Graph page - Display menu

  User opens the Graph page and manipulates the "error-rates" demo

  Background:
    Given user is at administrator perspective

  # NOTE: Graph Find/Hide has its own test script
  # NOTE: Operation nodes has its own test script
  # NOTE: Traffic animation, missing sidecars, virtual service, and idle edge options are nominally tested

  @error-rates-app
  @core-1
  @offline
  Scenario: Graph no namespaces
    When user graphs "" namespaces
    Then user sees no namespace selected

  # default should show empty graph
  @core-1
  @offline
  Scenario: Show empty graph
    When user graphs "default" namespaces
    Then user sees empty graph

  @error-rates-app
  @core-1
  @offline
  Scenario: Show idle nodes
    When user graphs "istio-system" namespaces
    And user "opens" display menu

  @error-rates-app
  @core-1
  @offline
  Scenario: User enables idle nodes
    When user "opens" display menu
    And user "enables" "idle nodes" option
    Then user sees the "istio-system" namespace
    And idle nodes "appear" in the graph
    And user "closes" display menu

  @error-rates-app
  @core-1
  @offline
  Scenario: User disables idle nodes
    When user "opens" display menu
    And user "disables" "idle nodes" option
    Then idle nodes "do not appear" in the graph
    And user "closes" display menu

  @error-rates-app
  @core-1
  @offline
  Scenario: Graph alpha and beta namespaces
    When user graphs "alpha,beta" namespaces
    Then user sees the "alpha" namespace
    And user sees the "beta" namespace

  @error-rates-app
  @core-1
  @offline
  Scenario: User clicks Display Menu
    When user "opens" display menu
    Then the display menu opens
    And the display menu has default settings
    And the graph reflects default settings
    And user "closes" display menu

  # percentile variable must match input id
  # edge label variable must match edge data name
  @error-rates-app
  @core-1
  Scenario: Average Response-time edge labels
    When user "opens" display menu
    And user enables "avg" "responseTime" edge labels
    Then user sees "responseTime" edge labels
    And user "closes" display menu

  # percentile variable must match input id
  # edge label variable must match edge data name
  @error-rates-app
  @core-1
  Scenario: Median Response-time edge labels
    When user "opens" display menu
    And user enables "rt50" "responseTime" edge labels
    Then user sees "responseTime" edge labels
    And user "closes" display menu

  # percentile variable must match input id
  # edge label variable must match edge data name
  @error-rates-app
  @core-1
  @offline
  Scenario: 95th Percentile Response-time edge labels
    When user "opens" display menu
    And user enables "rt95" "responseTime" edge labels
    Then user sees "responseTime" edge labels
    And user "closes" display menu

  # percentile variable must match input id
  # edge label variable must match edge data name
  @error-rates-app
  @core-1
  Scenario: 99th Percentile Response-time edge labels
    When user "opens" display menu
    And user enables "rt99" "responseTime" edge labels
    Then user sees "responseTime" edge labels
    And user "closes" display menu

  # edge label variable must match edge data name
  @error-rates-app
  @core-1
  Scenario: Disable response time edge labels
    When user "opens" display menu
    And user "disables" "responseTime" edge labels
    Then user sees "responseTime" edge label option is closed
    And user "closes" display menu

  # percentile variable must match input id
  # edge label variable must match edge data name
  @error-rates-app
  @core-1
  Scenario: Request Throughput edge labels
    When user "opens" display menu
    And user enables "throughputRequest" "throughput" edge labels
    Then user sees "throughput" edge labels
    And user "closes" display menu

  # percentile variable must match input id
  # edge label variable must match edge data name
  @error-rates-app
  @core-1
  Scenario: Response Throughput edge labels
    When user "opens" display menu
    And user enables "throughputResponse" "throughput" edge labels
    Then user sees "throughput" edge labels
    And user "closes" display menu

  # edge label variable must match edge data name
  @error-rates-app
  @core-1
  @offline
  Scenario: Disable throughput edge labels
    When user "opens" display menu
    And user "disables" "throughput" edge labels
    Then user sees "throughput" edge label option is closed
    And user "closes" display menu

  # edge label variable must match edge data name
  @error-rates-app
  @core-1
  @offline
  Scenario: Enable Traffic Distribution edge labels
    When user "opens" display menu
    And user "enables" "trafficDistribution" edge labels
    Then user sees "trafficDistribution" edge labels
    And user "closes" display menu

  # edge label variable must match edge data name
  @error-rates-app
  @core-1
  @offline
  Scenario: Disable Traffic Distribution edge labels
    When user "opens" display menu
    And user "disables" "trafficDistribution" edge labels
    Then user sees "trafficDistribution" edge label option is closed
    And user "closes" display menu

  # edge label variable must match edge data name
  @error-rates-app
  @core-1
  @offline
  Scenario: Enable Traffic Rate edge labels
    When user "opens" display menu
    And user "enables" "trafficRate" edge labels
    Then user sees "trafficRate" edge labels
    And user "closes" display menu

  # edge label variable must match edge data name
  @error-rates-app
  @core-1
  @offline
  Scenario: Disable Traffic Rate edge labels
    When user "opens" display menu
    And user "disables" "trafficRate" edge labels
    Then user sees "trafficRate" edge label option is closed
    And user "closes" display menu

  @error-rates-app
  @core-1
  @offline
  Scenario: User disables cluster boxes
    When user "opens" display menu
    And user "disables" "cluster boxes" option
    Then user does not see "Cluster" boxing
    And user "closes" display menu

  @error-rates-app
  @core-1
  @offline
  Scenario: User disables Namespace boxes
    When user "opens" display menu
    And user "disables" "namespace boxes" option
    Then user does not see "Namespace" boxing
    And user "closes" display menu

  @error-rates-app
  @core-1
  @offline
  Scenario: User enables idle edges
    When user "opens" display menu
    And user "enables" "idle edges" option
    Then idle edges "appear" in the graph
    And user "closes" display menu

  @error-rates-app
  @core-1
  @offline
  Scenario: User disables idle edges
    When user "opens" display menu
    And user "disables" "idle edges" option
    Then idle edges "do not appear" in the graph
    And user "closes" display menu

  @error-rates-app
  @core-1
  @offline
  Scenario: User enables rank
    When user "opens" display menu
    And user "enables" "rank" option
    Then ranks "appear" in the graph
    And user "closes" display menu

  @error-rates-app
  @core-1
  @offline
  Scenario: User disables rank
    When user "opens" display menu
    And user "disables" "rank" option
    Then ranks "do not appear" in the graph
    And user "closes" display menu

  @error-rates-app
  @core-1
  @offline
  Scenario: User disables service nodes
    When user "opens" display menu
    And user "disables" "service nodes" option
    Then user does not see service nodes
    And user "closes" display menu

  @error-rates-app
  @core-1
  Scenario: User enables security
    When user "opens" display menu
    And user "enables" "security" option
    Then security "appears" in the graph
    And user "closes" display menu

  @error-rates-app
  @core-1
  Scenario: User disables security
    When user "opens" display menu
    And user "disables" "security" option
    Then security "does not appear" in the graph
    And user "closes" display menu

  @error-rates-app
  @core-1
  @offline
  Scenario: User disables missing sidecars
    When user "opens" display menu
    And user "disables" "missing sidecars" option
    Then "missing sidecars" option "does not appear" in the graph
    And user "closes" display menu

  @error-rates-app
  @core-1
  @offline
  Scenario: User disables virtual services
    When user "opens" display menu
    And user "disables" "virtual services" option
    Then "virtual services" option "does not appear" in the graph
    And user "closes" display menu

  @error-rates-app
  @core-1
  @offline
  Scenario: User enables animation
    When user "opens" display menu
    And user "enables" "traffic animation" option
    Then "traffic animation" option "appears" in the graph
    And user "closes" display menu

  @error-rates-app
  @core-1
  @offline
  Scenario: User disables animation
    When user "opens" display menu
    And user "disables" "traffic animation" option
    Then "traffic animation" option "does not appear" in the graph
    And user "closes" display menu

  @error-rates-app
  @core-1
  @offline
  Scenario: User resets to factory default setting
    When user resets to factory default
    And user "opens" display menu
    Then the display menu opens
    And the display menu has default settings
    And user "closes" display menu

  @error-rates-app
  @core-1
  @offline
  Scenario: User observes some options not being clickable when switching to Service graph
    When user "opens" display menu
    And user "disables" "service nodes" option
    And user "enables" "operation nodes" option
    And user selects "SERVICE" graph type
    And user "opens" display menu
    Then the display menu opens
    And the "service nodes" option should "not be checked" and "disabled"
    And the "operation nodes" option should "be checked" and "disabled"
    When user selects "APP" graph type
    And user "opens" display menu
    Then the display menu opens
    And the "service nodes" option should "not be checked" and "enabled"
    And the "operation nodes" option should "be checked" and "enabled"
    And user "closes" display menu

  @bookinfo-app
  @core-1
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

  #inspired by this: https://github.com/kiali/kiali/pull/6469
  #in order to test this properly, Istio CRDs should be enabled in west and atleast 1 Istio object should be created there
  @multi-cluster
  @multi-primary
  Scenario: See Istio config validations from both clusters
    Given there are Istio objects in the "bookinfo" namespace for "east" cluster
    And there are Istio objects in the "bookinfo" namespace for "west" cluster
    When user graphs "bookinfo" namespaces
    And autorefresh is enabled
    Then the Istio objects for the "bookinfo" namespace for both clusters should be grouped together in the panel

  @ambient
  @offline
  Scenario: User sees tcp traffic
    When user graphs "bookinfo" namespaces
    Then user sees the "bookinfo" namespace
    Then user "opens" traffic menu
    And user "disables" "http" traffic option
    And user "closes" traffic menu
    Then 6 edges appear in the graph

  @ambient
  @offline
  Scenario: User sees http traffic
    When user graphs "bookinfo" namespaces
    Then user sees the "bookinfo" namespace
    Then user "opens" traffic menu
    And user "disables" "tcp" traffic option
    And user "closes" traffic menu
    Then 2 edges appear in the graph
