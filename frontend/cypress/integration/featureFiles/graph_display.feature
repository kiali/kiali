Feature: Kiali Graph page - Display menu

  User opens the Graph page and manipulates the "error-rates" demo

  Background:
    Given user is at administrator perspective

# NOTE: Graph Find/Hide (compressOnHide) has its own test script
# NOTE: Operation nodes has its own test script
# NOTE: Traffic animation, missing sidecars, virtual service options are nominally tested

@graph-page-display
Scenario: Graph no namespaces
  When user graphs "" namespaces
  Then user sees no namespace selected

# istio-system will only show nodes when idle-nodes is enabled
@graph-page-display
Scenario: Graph alpha and beta and istio-system namespaces
  When user graphs "alpha,beta,istio-system" namespaces
  Then user sees the "alpha" namespace
  And user sees the "beta" namespace
  And user sees the "istio-system" namespace

@graph-page-display
Scenario: User clicks Display Menu
  When user opens display menu
  Then the display menu opens
  And the display menu has default settings
  And the graph reflects default settings

# percentile variable must match input id
# edge label variable must match edge data name
@graph-page-display
Scenario: Average Response-time edge labels
  When user enables "avg" "responseTime" edge labels
  Then user sees "responseTime" edge labels

# percentile variable must match input id
# edge label variable must match edge data name
@graph-page-display
Scenario: Median Response-time edge labels
  When user enables "rt50" "responseTime" edge labels
  Then user sees "responseTime" edge labels

# percentile variable must match input id
# edge label variable must match edge data name
@graph-page-display
Scenario: 95th Percentile Response-time edge labels
  When user enables "rt95" "responseTime" edge labels
  Then user sees "responseTime" edge labels

# percentile variable must match input id
# edge label variable must match edge data name
@graph-page-display
Scenario: 99th Percentile Response-time edge labels
  When user enables "rt99" "responseTime" edge labels
  Then user sees "responseTime" edge labels

# edge label variable must match edge data name
@graph-page-display
Scenario: Disable response time edge labels
  When user "disables" "responseTime" edge labels
  Then user sees "responseTime" edge label option is closed

# percentile variable must match input id
# edge label variable must match edge data name
@graph-page-display
Scenario: Request Throughput edge labels
  When user enables "throughputRequest" "throughput" edge labels
  Then user sees "throughput" edge labels

# percentile variable must match input id
# edge label variable must match edge data name
@graph-page-display
Scenario: Response Throughput edge labels
  When user enables "throughputResponse" "throughput" edge labels
  Then user sees "throughput" edge labels

# edge label variable must match edge data name
@graph-page-display
Scenario: Disable throughput edge labels
  When user "disables" "throughput" edge labels
  Then user sees "throughput" edge label option is closed

# edge label variable must match edge data name
@graph-page-display
Scenario: Enable Traffic Distribution edge labels
  When user "enables" "trafficDistribution" edge labels
  Then user sees "trafficDistribution" edge labels

# edge label variable must match edge data name
@graph-page-display
Scenario: Disable Traffic Distribution edge labels
  When user "disables" "trafficDistribution" edge labels
  Then user sees "trafficDistribution" edge label option is closed

# edge label variable must match edge data name
@graph-page-display
Scenario: Enable Traffic Rate edge labels
  When user "enables" "trafficRate" edge labels
  Then user sees "trafficRate" edge labels

# edge label variable must match edge data name
@graph-page-display
Scenario: Disable Traffic Distribution edge labels
  When user "disables" "trafficRate" edge labels
  Then user sees "trafficRate" edge label option is closed

@graph-page-display
Scenario: User disables cluster boxes
  When user "disables" "cluster boxes" option
  Then user does not see "Cluster" boxing

@graph-page-display
Scenario: User disables Namespace boxes
  When user "disables" "namespace boxes" option
  Then user does not see "Namespace" boxing

@graph-page-display
Scenario: User enables idle edges
  When user "enables" "idle edges" option
  Then idle edges "appear" in the graph

@graph-page-display
Scenario: User enables idle nodes
  When user "enables" "idle nodes" option
  Then idle nodes "appear" in the graph

@graph-page-display
Scenario: User disables idle edges
  When user "disables" "idle edges" option
  Then idle edges "do not appear" in the graph

@graph-page-display
Scenario: User disables idle nodes
  When user "disables" "idle nodes" option
  Then idle nodes "do not appear" in the graph

@graph-page-display
Scenario: User enables rank
  When user "enables" "rank" option
  Then ranks "appear" in the graph

@graph-page-display
Scenario: User disables rank
  When user "disables" "rank" option
  Then ranks "do not appear" in the graph

@graph-page-display
Scenario: User disables service nodes
  When user "disables" "service nodes" option
  Then user does not see service nodes

@graph-page-display
Scenario: User enables security
  When user "enables" "security" option
  Then security "appears" in the graph

@graph-page-display
Scenario: User disables security
  When user "disables" "security" option
  Then security "does not appear" in the graph

@graph-page-display
Scenario: User disables missing sidecars
  When user "disables" "missing sidecars" option
  Then "missing sidecars" option "does not appear" in the graph

@graph-page-display
Scenario: User disables virtual services
  When user "disables" "virtual services" option
  Then "virtual services" option "does not appear" in the graph

@graph-page-display
Scenario: User enables animation
  When user "enables" "traffic animation" option
  Then "traffic animation" option "appears" in the graph

@graph-page-display
Scenario: User disables animation
  When user "disables" "traffic animation" option
  Then "traffic animation" option "does not appear" in the graph

@graph-page-display
Scenario: User resets to factory default
  When user resets to factory default
  And user opens display menu
  Then the display menu opens
  And the display menu has default settings
