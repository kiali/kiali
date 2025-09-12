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

  @skip-ossmc
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
    And validates waypoint Info data for "service"

  Scenario: [Workload details - ztunnel] The workload details for a ztunnel are valid
    Given user is at the details page for the "workload" "ztunnel/ztunnel" located in the "" cluster
    Then the user cannot see the "missing-sidecar" badge for "ztunnel" workload in "istio-system" namespace
    And the proxy status is "healthy"
    And the user validates the Ztunnel tab for the "bookinfo" namespace

  Scenario: [Traffic Graph] User sees ztunnel traffic
    Given user is at the "graph" page
    When user graphs "bookinfo" namespaces
    Then user sees the "bookinfo" namespace
    Then user "opens" traffic menu
    And user "enables" "ambientZtunnel" traffic option
    And user "closes" traffic menu
    Then 5 edges appear in the graph including Prometheus

  Scenario: [Traffic Graph] User sees no Ambient traffic
    Given user is at the "graph" page
    When user graphs "bookinfo" namespaces
    Then user sees the "bookinfo" namespace
    Then user "opens" traffic menu
    And user "disables" "ambient" traffic option
    And user "closes" traffic menu
    Then 2 edges appear in the graph

  Scenario: [Traffic Graph] User sees all Ambient traffic
    Given user is at the "graph" page
    When user graphs "bookinfo" namespaces
    Then user sees the "bookinfo" namespace
    Then user "opens" traffic menu
    And user "enables" "ambientTotal" traffic option
    And user "enables" "ambient" traffic option
    And user "closes" traffic menu
    Then 14 edges appear in the graph including Prometheus

  Scenario: [Traffic Graph] User doesn't see waypoint proxy
    And the "waypoint" node "doesn't" exists

  Scenario: [Traffic Graph] User sees waypoint proxy
    When user "opens" display menu
    Then the display menu opens
    Then user "enables" "filterWaypoints" edge labels
    Then user "opens" traffic menu
    And user "enables" "ambientTotal" traffic option
    And user "closes" traffic menu
    Then 16 edges appear in the graph
    And the "waypoint" node "does" exists

  Scenario: [Traffic Graph] User sees waypoint traffic
    Given user is at the "graph" page
    When user graphs "bookinfo" namespaces
    Then user sees the "bookinfo" namespace
    Then user "opens" traffic menu
    And user "enables" "ambientWaypoint" traffic option
    And user "closes" traffic menu
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

  Scenario: [Traffic] Waypoint for different namespaces working as expected
    Given user is at the "graph" page
    When user graphs "waypoint-differentns" namespaces
    Then user sees the "waypoint-differentns" namespace
    Then user "opens" traffic menu
    And user "enables" "ambient" traffic option
    And user "enables" "http" traffic option
    And user "closes" traffic menu
    Then user "opens" display menu
    And user "disables" "waypoint proxies" option
    And user "closes" display menu
    Then 2 edges appear in the graph
    And the "echo-server" node "does" exists
    And the "curl-client" node "does" exists

  Scenario: [Traffic] Waypoint for different namespaces working as expected with waypoints
    Given user is at the "graph" page
    When user graphs "waypoint-differentns" namespaces
    Then user sees the "waypoint-differentns" namespace
    Then user "opens" traffic menu
    And user "enables" "ambient" traffic option
    And user "enables" "http" traffic option
    And user "closes" traffic menu
    Then user "opens" display menu
    And user "enables" "waypoint proxies" option
    And user "closes" display menu
    Then 4 edges appear in the graph
    Then user "opens" traffic menu
    And user "disables" "http" traffic option
    And user "closes" traffic menu
    Then 2 edges appear in the graph

  Scenario: [Traffic] Waypoint for all
    Given user is at the "graph" page
    When user graphs "waypoint-forall" namespaces
    Then user sees the "waypoint-forall" namespace
    Then user "opens" traffic menu
    And user "enables" "ambient" traffic option
    And user "enables" "http" traffic option
    And user "closes" traffic menu
    Then user "opens" display menu
    And user "disables" "waypoint proxies" option
    And user "closes" display menu
    Then 2 edges appear in the graph
    And the "echo-server" node "does" exists
    And the "curl-client" node "does" exists

  Scenario: [Traffic] Waypoint for all with waypoint
    Given user is at the "graph" page
    When user graphs "waypoint-forall" namespaces
    Then user sees the "waypoint-forall" namespace
    Then user "opens" traffic menu
    And user "enables" "ambient" traffic option
    And user "enables" "http" traffic option
    And user "closes" traffic menu
    Then user "opens" display menu
    And user "enables" "waypoint proxies" option
    And user "closes" display menu
    Then 4 edges appear in the graph
    And the "cgw" node "does" exists
    Then user "opens" traffic menu
    And user "disables" "http" traffic option
    And user "closes" traffic menu
    Then 2 edges appear in the graph

  Scenario: [Traffic] Waypoint for none
    Given user is at the "graph" page
    When user graphs "waypoint-fornone" namespaces
    Then user sees the "waypoint-fornone" namespace
    Then user "opens" traffic menu
    And user "enables" "ambient" traffic option
    And user "enables" "http" traffic option
    And user "closes" traffic menu
    Then user "opens" display menu
    And user "disables" "waypoint proxies" option
    And user "closes" display menu
    Then 2 edges appear in the graph
    And the "echo-server" node "does" exists
    And the "curl-client" node "does" exists

  Scenario: [Traffic] Waypoint for none with waypoint proxies
    Given user is at the "graph" page
    When user graphs "waypoint-fornone" namespaces
    Then user sees the "waypoint-fornone" namespace
    Then user "opens" traffic menu
    And user "enables" "ambient" traffic option
    And user "enables" "http" traffic option
    And user "closes" traffic menu
    Then user "opens" display menu
    And user "enables" "waypoint proxies" option
    And user "closes" display menu
    Then 2 edges appear in the graph
    Then user "opens" traffic menu
    And user "disables" "http" traffic option
    And user "closes" traffic menu
    Then 0 edges appear in the graph

  Scenario: [Traffic] Waypoint for service
    Given user is at the "graph" page
    When user graphs "waypoint-forservice" namespaces
    Then user sees the "waypoint-forservice" namespace
    Then user "opens" traffic menu
    And user "enables" "http" traffic option
    And user "closes" traffic menu
    Then user "opens" display menu
    And user "disables" "waypoint proxies" option
    And user "closes" display menu
    Then 2 edges appear in the graph
    And the "echo-server" node "does" exists
    And the "curl-client" node "does" exists

  Scenario: [Traffic] Waypoint for service with waypoints
    Given user is at the "graph" page
    When user graphs "waypoint-forservice" namespaces
    Then user sees the "waypoint-forservice" namespace
    Then user "opens" traffic menu
    And user "enables" "http" traffic option
    And user "closes" traffic menu
    Then user "opens" display menu
    And user "enables" "waypoint proxies" option
    And user "closes" display menu
    Then 4 edges appear in the graph
    And the "waypoint" node "does" exists
    Then user "opens" traffic menu
    And user "disables" "http" traffic option
    Then 2 edges appear in the graph

  Scenario: [Traffic] Waypoint for workload
    Given user is at the "graph" page
    When user graphs "waypoint-forworkload" namespaces
    Then user sees the "waypoint-forworkload" namespace
    Then user "opens" traffic menu
    And user "enables" "http" traffic option
    And user "closes" traffic menu
    Then user "opens" display menu
    And user "disables" "waypoint proxies" option
    And user "closes" display menu
    Then 1 edges appear in the graph
    And the "unknown" service "does" exists
    And the "curl-client" node "does" exists

  Scenario: [Traffic] Waypoint for workload with waypoints
    Given user is at the "graph" page
    When user graphs "waypoint-forworkload" namespaces
    Then user sees the "waypoint-forworkload" namespace
    Then user "opens" traffic menu
    And user "enables" "http" traffic option
    And user "closes" traffic menu
    Then user "opens" display menu
    And user "enables" "waypoint proxies" option
    And user "closes" display menu
    Then 3 edges appear in the graph
    And the "bwaypoint" node "does" exists
    Then user "opens" traffic menu
    And user "disables" "http" traffic option
    And user "closes" traffic menu
    Then 2 edges appear in the graph

  Scenario: [Traffic] Waypoint override
    Given user is at the "graph" page
    When user graphs "waypoint-override" namespaces
    Then user sees the "waypoint-override" namespace
    Then user "opens" traffic menu
    And user "enables" "http" traffic option
    And user "closes" traffic menu
    Then user "opens" display menu
    And user "disables" "waypoint proxies" option
    And user "closes" display menu
    Then 2 edges appear in the graph
    And the "echo-server" node "does" exists
    And the "curl-client" node "does" exists

  Scenario: [Traffic] Waypoint override with waypoints
    Given user is at the "graph" page
    When user graphs "waypoint-override" namespaces
    Then user sees the "waypoint-override" namespace
    Then user "opens" traffic menu
    And user "enables" "http" traffic option
    And user "closes" traffic menu
    Then user "opens" display menu
    And user "enables" "waypoint proxies" option
    And user "closes" display menu
    Then 4 edges appear in the graph
    And the "use-this" node "does" exists
    Then user "opens" traffic menu
    And user "disables" "http" traffic option
    And user "closes" traffic menu
    Then 2 edges appear in the graph

  Scenario: [Waypoint details] The waypoint details for a waypoint for none are valid
    Given user is at the details page for the "workload" "waypoint-fornone/curl-client" located in the "" cluster
    And the user doesn't see a L7 link
    And user is at the details page for the "workload" "waypoint-fornone/waypoint" located in the "" cluster
    When the user goes to the "Waypoint" tab
    Then the "Services" subtab doesn't exist
    Then the "Workloads" subtab doesn't exist
    Then user goes to the waypoint "Info" subtab
    And validates waypoint Info data for "none"

  Scenario: [Waypoint details] The waypoint details for a waypoint for service are valid
    Given user is at the details page for the "workload" "waypoint-forservice/curl-client" located in the "" cluster
    And the user sees the L7 "waypoint" link
    And the link for the waypoint "waypoint" should redirect to a valid workload details
    When the user goes to the "Waypoint" tab
    Then user goes to the waypoint "Services" subtab
    And validates Services data with "1" rows and "echo-service" workload, "waypoint-forservice" namespace, "namespace" label for, "pfbadge-S" badge
    Then user goes to the waypoint "Info" subtab
    And validates waypoint Info data for "service"

  Scenario: [Waypoint details] The waypoint details for a waypoint in different ns are valid
    Given user is at the details page for the "workload" "waypoint-differentns/curl-client" located in the "" cluster
    And the user sees the L7 "egress-gateway" link
    And the link for the waypoint "egress-gateway" should redirect to a valid workload details
    When the user goes to the "Waypoint" tab
    Then user goes to the waypoint "Services" subtab
    And validates Services data with "1" rows and "echo-service" workload, "waypoint-differentns" namespace, "namespace" label for, "pfbadge-S" badge
    Then user goes to the waypoint "Info" subtab
    And validates waypoint Info data for "service"

  Scenario: [Waypoint details] The waypoint details for a waypoint for all are valid
    Given user is at the details page for the "workload" "waypoint-forall/curl-client" located in the "" cluster
    And the user sees the L7 "cgw" link
    And the link for the waypoint "cgw" should redirect to a valid workload details
    When the user goes to the "Waypoint" tab
    Then user goes to the waypoint "Services" subtab
    And validates Services data with "1" rows and "echo-service" workload, "waypoint-forall" namespace, "namespace" label for, "pfbadge-S" badge
    Then user goes to the waypoint "Workloads" subtab
    And validates Services data with "2" rows and "echo-server" workload, "waypoint-forall" namespace, "namespace" label for, "pfbadge-W" badge
    Then user goes to the waypoint "Info" subtab
    And validates waypoint Info data for "all"

  Scenario: [Waypoint details] The waypoint details for a waypoint for workload are valid
    Given user is at the details page for the "workload" "waypoint-forworkload/echo-server" located in the "" cluster
    And the user sees the L7 "bwaypoint" link
    And the link for the waypoint "waypoint" should redirect to a valid workload details
    When the user goes to the "Waypoint" tab
    Then user goes to the waypoint "Workloads" subtab
    And validates Services data with "1" rows and "echo-server" workload, "waypoint-forworkload" namespace, "workload" label for, "pfbadge-W" badge
    Then user goes to the waypoint "Info" subtab
    And validates waypoint Info data for "workload"

  Scenario: [Waypoint details] The waypoint details for a waypoint override are valid
  # TODO: This shouldn't be right
    Given user is at the details page for the "workload" "waypoint-override/curl-client" located in the "" cluster
    And the user sees the L7 "waypoint" link
    And the link for the waypoint "waypoint" should redirect to a valid workload details
    When the user goes to the "Waypoint" tab
    Then user goes to the waypoint "Services" subtab
    And validates Services data with "1" rows and "echo-service" workload, "waypoint-override" namespace, "namespace" label for, "pfbadge-S" badge
    Then user goes to the waypoint "Info" subtab
    And validates waypoint Info data for "service"
  # TODO: End-Todo
    Then user is at the details page for the "workload" "waypoint-override/echo-server" located in the "" cluster
    And the user sees the L7 "use-this" link
    And the link for the waypoint "use-this" should redirect to a valid workload details
    When the user goes to the "Waypoint" tab
    Then user goes to the waypoint "Services" subtab
    And validates Services data with "1" rows and "echo-service" workload, "waypoint-override" namespace, "service" label for, "pfbadge-S" badge
    Then user goes to the waypoint "Info" subtab
    And validates waypoint Info data for "service"

  Scenario: [Waypoint details] The waypoint workload log level os updated
    Given user is at the details page for the "workload" "bookinfo/waypoint" located in the "" cluster
    When the user goes to the "Logs" tab
    Then the user updates the log level to "Debug"

  Scenario: [Traffic] Sidecar Ambient traffic
    Given user is at the "graph" page
    When user graphs "test-ambient,test-sidecar" namespaces
    Then user sees the "test-ambient" namespace
    Then user sees the "test-sidecar" namespace
    Then user "opens" traffic menu
    And user "enables" "http" traffic option
    And user "closes" traffic menu
    Then user "opens" display menu
    And user "enables" "security" option
    Then 9 edges appear in the graph
    Then security "appears" in the graph
    And user "closes" display menu
    Then user "opens" traffic menu
    And user "disables" "ambient" traffic option
    And user "closes" traffic menu
    Then 5 edges appear in the graph
    Then user "opens" traffic menu
    Then user "enables" "ambient" traffic option
    Then user "disables" "tcp" traffic option
    Then 4 edges appear in the graph
    Then user "closes" traffic menu

  Scenario: [Overview] Add to Ambient in the test-sidecar namespace
    Given user is at administrator perspective
    Given user is at the "overview" page
    And user filters "test-sidecar" namespace
    And user opens the menu
    And the option "Add to Ambient" does not exist for "test-sidecar" namespace
    And the user clicks on "removes auto injection" for "test-sidecar" namespace
    Then "default" badge "not exist"
    And user opens the menu
    And the user clicks on "Add to Ambient" for "test-sidecar" namespace
    Then "Ambient" badge "exist"
    And user opens the menu
    And the user clicks on "remove Ambient" for "test-sidecar" namespace
    And user opens the menu
    And the user clicks on "enable sidecar" for "test-sidecar" namespace
    Then "default" badge "exist"
