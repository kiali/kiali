@mesh-page
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
    Then mesh side panel is shown
    And user sees expected mesh infra

  Scenario: Test istiod
    When user selects mesh node with label "istiod-default"
    Then user sees control plane side panel

  Scenario: Grafana Infra
    When user selects mesh node with label "Grafana"
    Then user sees "Grafana" node side panel

  Scenario: Jaeger Infra
    When user selects mesh node with label "jaeger"
    Then user sees "jaeger" node side panel

  Scenario: Prometheus Infra
    When user selects mesh node with label "Prometheus"
    Then user sees "Prometheus" node side panel

  Scenario: Test DataPlane
    When user selects mesh node with label "Data Plane"
    Then user sees data plane side panel

  Scenario: Test Kubernetes
    When user selects mesh node with label "Kubernetes"
    Then user sees "Kubernetes" cluster side panel

  Scenario: Test istio-system
    When user selects mesh node with label "istio-system"
    Then user sees "istio-system" namespace side panel
