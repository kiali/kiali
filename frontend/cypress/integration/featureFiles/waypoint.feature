@waypoint
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Waypoint related features

  The user should be able to see all the Waypoint features across
  different Kiali pages, in an Ambient Mesh, where the namespace is
  Ambient labeled and includes de Waypoint label.

  Background:
    Given user is at administrator perspective

  Scenario: [Setup] namespace is labeled with waypoint label
    Then "bookinfo" namespace is labeled with the waypoint label
    And the graph page has enough data

  Scenario: [Workload list] See the workload list of bookinfo with the correct info
    Given user is at the "workloads" list page
    When user selects the "bookinfo" namespace
    Then the "waypoint" row is visible
    And the health column on the "waypoint" row has a health icon
    And the "Labels" column on the "waypoint" row has the text "gateway.istio.io/managed=istio.io-mesh-controller"
    And the "Labels" column on the "waypoint" row has the text "gateway.networking.k8s.io/gateway-name=waypoint"
    And the "Type" column on the "waypoint" row has the text "Deployment"
    And the "Details" column on the "waypoint" row has the text "Waypoint Proxy"
    And the "Details" column on the "waypoint" row has a link ending in "bookinfo/istio/gateway.networking.k8s.io/v1/Gateway/waypoint"

  Scenario: [Workload details - productpage] The workload productpage is enrolled in waypoint
    Given user is at the details page for the "workload" "bookinfo/productpage-v1" located in the "" cluster
    Then user sees "ambient" badge
    Then the user cannot see the "missing-sidecar" badge for "product-v1" workload in "bookinfo" namespace
    And the user hovers in the "ambient" label and sees "L4" in the tooltip
    And the user hovers in the "ambient" label and sees "L7" in the tooltip
    And the user sees the "Protocol" option in the pod tooltip, and is "HBONE"
    And the user sees the L7 "waypoint" link
    And the link for the waypoint "waypoint" should redirect to a valid workload details

    Scenario: [Workload details - waypoint] The workload details for a waypoint are valid
    Given user is at the details page for the "workload" "bookinfo/waypoint" located in the "" cluster
    Then the user sees the "L7" badge
    Then the user cannot see the "missing-sidecar" badge for "waypoint" workload in "bookinfo" namespace
    And the proxy status is "info" with "RDS: IGNORED" details
    And the user can see the "K8sGateway-bookinfo-waypoint" istio config and badge "pfbadge-G"
    And user sees trace information
    When user selects a trace
    Then user sees trace details
    When the user looks for the bootstrap tab
    Then the user sees bootstrap expected information
    When the user goes to the "Waypoint" tab
    Then user goes to the waypoint "Services" subtab
    And validates Services data
    Then user goes to the waypoint "Info" subtab
    And validates waypoint Info data

    Scenario: [Workload details - ztunnel] The workload details for a ztunnel are valid
    Given user is at the details page for the "workload" "istio-system/ztunnel" located in the "" cluster
    Then the user cannot see the "missing-sidecar" badge for "ztunnel" workload in "istio-system" namespace
    And the proxy status is "healthy"
    And the user validates the Ztunnel tab

  Scenario: [Traffic Graph] User sees ztunnel traffic
    Given user is at the "graphpf" page
    When user graphs "bookinfo" namespaces
    Then user sees the "bookinfo" namespace
    Then user opens traffic menu
    And user "enables" "ambientZtunnel" traffic option
    Then 7 edges appear in the graph

  Scenario: [Traffic Graph] User sees no Ambient traffic
    Given user is at the "graphpf" page
    When user graphs "bookinfo" namespaces
    Then user sees the "bookinfo" namespace
    Then user opens traffic menu
    And user "disables" "ambient" traffic option
    Then 2 edges appear in the graph

  Scenario: [Traffic Graph] User sees all Ambient traffic
    Given user is at the "graphpf" page
    When user graphs "bookinfo" namespaces
    Then user sees the "bookinfo" namespace
    Then user opens traffic menu
    And user "enables" "ambientTotal" traffic option
    And user "enables" "ambient" traffic option
    Then 16 edges appear in the graph

  Scenario: [Traffic Graph] User doesn't see waypoint proxy
    And the "waypoint" node "doesn't" exists

  Scenario: [Traffic Graph] User sees waypoint proxy
    When user opens display menu
    Then the display menu opens
    Then user "enables" "filterWaypoints" edge labels
    Then user opens traffic menu
    And user "enables" "ambientTotal" traffic option
    Then 16 edges appear in the graph
    And the "waypoint" node "does" exists

  Scenario: [Traffic Graph] User sees waypoint traffic
    Given user is at the "graphpf" page
    When user graphs "bookinfo" namespaces
    Then user sees the "bookinfo" namespace
    Then user opens traffic menu
    And user "enables" "ambientWaypoint" traffic option
    Then 11 edges appear in the graph

  Scenario: [Istio Config] Waypoint should not have validation errors
    Given user is at the "istio" page
    And user selects the "bookinfo" namespace
    Then the "K8sGateway" object in "bookinfo" namespace with "waypoint" name Istio Config is valid

  Scenario: [Overview] Namespace is labeled with the waypoint labels
    Given user is at the "overview" page
    When user clicks in the "LIST" view
    Then user sees a "LIST" "bookinfo" namespace
    And badge for "istio.io/use-waypoint=waypoint" is visible in the LIST view in the namespace "bookinfo"

  @waypoint-wp
  Scenario: [Traffic] Waypoint for different namespaces working as expected
    Given user is at the "graphpf" page
    When user graphs "waypoint-differentns" namespaces
    Then user sees the "waypoint-differentns" namespace
    Then 2 edges appear in the graph
    And the "echo-server" node "does" exists
    And the "curl-client" node "does" exists
    Then user opens display menu
    And user "enables" "waypoint proxies" option
    Then 4 edges appear in the graph
    Then user opens traffic menu
    And user "disables" "http" traffic option
    Then 2 edges appear in the graph
