@waypoint
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Waypoint related features

  The user should be able to see all the Waypoint features across
  different Kiali pages, in an Ambient Mesh, where the namespace is
  Ambient labeled and includes de Waypoint label.

  Background:
    Given user is at administrator perspective

  @waypoint
  Scenario: namespace is labeled with waypoint label
    Then "bookinfo" namespace is labeled with the waypoint label

  @waypoint
  Scenario: See the waypoint workload with the correct info
    Given user is at the "workloads" list page
    When user selects the "bookinfo" namespace
    Then the "waypoint" row is visible
    And the health column on the "waypoint" row has a health icon
    And the "Labels" column on the "waypoint" row has the text "gateway.istio.io/managed=istio.io-mesh-controller"
    And the "Labels" column on the "waypoint" row has the text "gateway.networking.k8s.io/gateway-name=waypoint"
    And the "Labels" column on the "waypoint" row has the text "istio.io/gateway-name=waypoint"
    And the "Type" column on the "waypoint" row has the text "Deployment"
    And the "Details" column on the "waypoint" row has the text "Waypoint Proxy"

  @waypoint
  Scenario: The workload productpage is enrolled in waypoint
    Given user is at the details page for the "workload" "bookinfo/productpage-v1" located in the "" cluster
    Then user sees "ambient" badge
    Then the user cannot see the "missing-sidecar" badge for "product-v1" workload in "bookinfo" namespace
    And the user hovers in the "ambient" label and sees "L4" in the tooltip
    And the user hovers in the "ambient" label and sees "L7" in the tooltip

  @waypoint
  @pft
  Scenario: User sees ztunnel traffic
    Given user is at the "graphpf" page
    When user graphs "bookinfo" namespaces in the patternfly graph
    Then user sees the "bookinfo" namespace
    Then user opens traffic menu
    And user "enables" "ambientZtunnel" traffic option
    Then 7 edges appear in the patternfly graph

  @waypoint
  @pft
  Scenario: User sees waypoint traffic
    Given user is at the "graphpf" page
    When user graphs "bookinfo" namespaces in the patternfly graph
    Then user sees the "bookinfo" namespace
    Then user opens traffic menu
    And user "enables" "ambientWaypoint" traffic option
    Then 11 edges appear in the patternfly graph

  @waypoint
  @pft
  Scenario: User sees no Ambient traffic
    Given user is at the "graphpf" page
    When user graphs "bookinfo" namespaces in the patternfly graph
    Then user sees the "bookinfo" namespace
    Then user opens traffic menu
    And user "disables" "ambient" traffic option
    Then 2 edges appear in the patternfly graph

  @waypoint
  @pft
  Scenario: User sees all Ambient traffic
    Given user is at the "graphpf" page
    When user graphs "bookinfo" namespaces in the patternfly graph
    Then user sees the "bookinfo" namespace
    Then user opens traffic menu
    And user "enables" "ambientTotal" traffic option
    And user "enables" "ambient" traffic option
    Then 16 edges appear in the patternfly graph

  @waypoint
  @pft
  Scenario: User sees doesn't see waypoint proxy
    And the "waypoint" node "doesn't" exists

  @waypoint
  @pft
  Scenario: User sees waypoint proxy
    When user opens display menu
    Then the display menu opens
    Then user "enables" "filterWaypoints" edge labels
    Then 16 edges appear in the patternfly graph
    And the "waypoint" node "does" exists

  @waypoint
  @pft
  Scenario: Waypoint should not have validation errors
    Given user is at the "istio" page
    And user selects the "bookinfo" namespace
    Then the "K8sGateway" object in "bookinfo" namespace with "waypoint" name Istio Config is valid

  @waypoint
  Scenario: Namespace is labeled with the waypoint labels
    Given user is at the "overview" page
    When user clicks in the "LIST" view
    Then user sees a "LIST" "bookinfo" namespace
    And badge for "istio.io/use-waypoint=waypoint" is visible in the LIST view in the namespace "bookinfo"
