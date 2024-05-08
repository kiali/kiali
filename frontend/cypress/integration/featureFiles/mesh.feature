@mesh-page
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Mesh page

  User opens the Mesh page with bookinfo deployed

  Background:
    Given user is at administrator perspective
    And user is at the "mesh" page

# NOTE: Mesh Find/Hide has its own feature file

  @selected
  Scenario: Open mesh Tour
    When user opens mesh tour
    Then user "sees" mesh tour

  @selected
  Scenario: Close mesh Tour
    When user opens mesh tour
    And user closes mesh tour
    Then user "does not see" mesh tour

  @selected
  Scenario: See mesh
    Then mesh side panel is shown
    And user sees expected mesh infra

  @selected
  Scenario: Test istiod
    When user selects mesh node with label "istiod-default"
    Then user sees control plane side panel

  @selected
  Scenario: Grafana Infra
    When user selects mesh node with label "Grafana"
    Then user sees "Grafana" node side panel

  @selected
  Scenario: Jaeger Infra
    When user selects mesh node with label "jaeger"
    Then user sees "jaeger" node side panel

  @selected
  Scenario: Prometheus Infra
    When user selects mesh node with label "Prometheus"
    Then user sees "Prometheus" node side panel

  @selected
  Scenario: Test DataPlane
    When user selects mesh node with label "Data Plane"
    Then user sees data plane side panel

  @selected
  Scenario: Test Kubernetes
    When user selects mesh node with label "Kubernetes"
    Then user sees "Kubernetes" cluster side panel

  @selected
  Scenario: Test istio-system
    When user selects mesh node with label "istio-system"
    Then user sees "istio-system" namespace side panel
