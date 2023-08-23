@graph-display
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Graph page - Display menu

  User opens the Graph page and manipulates the "error-rates" demo

  Background:
    Given user is at administrator perspective

  # NOTE: Graph Find/Hide (compressOnHide) has its own test script
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

  @skip
  @multi-cluster
  Scenario: Graph bookinfo namespace for the multi-cluster setup
    When user graphs "bookinfo" namespaces
    Then user sees the "bookinfo" namespace
    And user sees the "bookinfo" namespace deployed across the "east" and "west" cluster
