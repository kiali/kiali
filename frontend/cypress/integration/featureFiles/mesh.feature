@mesh-page
@ossmc
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Mesh page

  User opens the Mesh page with bookinfo deployed

  Background:
    Given user is at administrator perspective
    And user is at the "mesh" page

# NOTE: Mesh Find/Hide has its own feature file

  Scenario: Open mesh Tour
    When user opens mesh tour
    Then user "sees" mesh tour

  Scenario: Close mesh Tour
    When user opens mesh tour
    And user closes mesh tour
    Then user "does not see" mesh tour

  Scenario: See mesh
    When user sees mesh side panel
    Then user sees expected mesh infra

  Scenario: Test istiod
    When user selects mesh node with label "istiod"
    Then user sees control plane side panel

  Scenario: Grafana Infra
    When user selects mesh node with label "Grafana"
    Then user sees "Grafana" node side panel

  Scenario: Tracing Infra
    When user selects tracing mesh node
    Then user sees tracing node side panel

  Scenario: Prometheus Infra
    When user selects mesh node with label "Prometheus"
    Then user sees "Prometheus" node side panel

  Scenario: Test DataPlane
    When user selects mesh node with label "Data Plane"
    Then user sees data plane side panel

  Scenario: Test Cluster
    When user selects cluster mesh node
    Then user sees cluster side panel

  Scenario: Test istio-system
    When user selects mesh node with label "istio-system"
    Then user sees "istio-system" namespace side panel
    Then user does not see "dataplane namespaces: 0" in mesh body

  @bookinfo-app
  Scenario: User enables gateways
    When user "opens" display menu
    And user "enables" mesh display option "gateways"
    And user "closes" display menu
    And user selects mesh node with label "bookinfo-gateway"
    Then user sees "bookinfo-gateway" node side panel

  @waypoint-tracing
  @bookinfo-app
  Scenario: User enables waypoints
    When user "opens" display menu
    And user "enables" mesh display option "waypoints"
    And user "closes" display menu
    And user selects mesh node with label "waypoint"
    Then user sees "waypoint" node side panel

  @waypoint-tracing
  Scenario: Test ztunnel
    When user selects mesh node with label "ztunnel" and nodeType "infra"
    Then user sees "ztunnel" node side panel

  @skip-ossmc
  Scenario: See the Mesh menu link
    Then user see the "mesh" menu

  @skip-ossmc
  Scenario: See the Mesh link in the about
    And user clicks on Help Button
    And user clicks on About Button
    Then user see the "mesh" link

  @multi-cluster
  Scenario: Primary-remote: see one dataplane for each cluster and one controlplane on primary attached to both.
    Then user sees 1 "dataplane" nodes on the "east" cluster
    And user sees 1 "dataplane" nodes on the "west" cluster
    And user sees 1 "istiod" nodes on the "east" cluster
    And user sees the istiod node connected to the dataplane nodes

  @multi-cluster
  @multi-primary
  Scenario: Multi-primary: see one dataplane and one controlplane for each cluster and an edge between each.
    Then user sees 1 "dataplane" nodes on the "east" cluster
    And user sees 1 "dataplane" nodes on the "west" cluster
    And user sees 1 "istiod" nodes on the "east" cluster
    And user sees 1 "istiod" nodes on the "west" cluster

  @component-health-upscale
  Scenario: Grafana Infra unreachable
    When user scales to "0" the "grafana" in namespace "istio-system"
    Then the user refreshes the page
    When user selects mesh node with label "Grafana"
    Then user sees "Grafana" node side panel
    Then user sees "Version: unknown" node side panel
    Then user sees "error" icon side panel
    When user scales to "1" the "grafana" in namespace "istio-system"
    Then the user refreshes the page
    When user selects mesh node with label "Grafana"
    Then user sees "Grafana" node side panel
    Then user sees "correct" icon side panel
    Then user does not see "error" icon side panel
    Then user does not see "warning" icon side panel

  @shared-mesh-config
  Scenario: Shared mesh config is seen on istiod panel
    When user selects mesh node with label "istiod"
    Then user sees control plane side panel
    And user sees "effective,standard,shared" configuration tabs
    And user sees "mode: REGISTRY_ONLY" in the "effective" configuration tab
    And user sees "mode: REGISTRY_ONLY" in the "shared" configuration tab
    And user does not see "mode: REGISTRY_ONLY" in the "standard" configuration tab

  Scenario: User opens and interacts with the Trace Configuration modal
    When user selects tracing mesh node
    And user opens the Trace Configuration modal
    Then user sees the Trace Configuration modal
    And user sees the Discovery and Tester tabs
    And user sees the action buttons fixed at the bottom
    And user verifies the Discovery information is correct
    When user clicks the Rediscover button in the Discovery tab
    And user verifies the Discovery information is correct
    When user switches to the Tester tab
    And user changes the provider in the Tester tab
    And user clicks the Test Configuration button
    Then user sees the Tester result "incorrect"
    And user changes the provider in the Tester tab
    And user clicks the Test Configuration button
    Then user sees the Tester result "correct"
