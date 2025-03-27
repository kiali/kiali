@masthead
@multi-cluster
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali masthead cluster components status

  User wants to verify the Kiali masthead content

  Background:
    Given user is at administrator perspective
    And user is at the "overview" page

  @multi-cluster
  Scenario: Cluster components healthy
    Then user sees "east" cluster label with a "success" icon
    When user hovers over the cluster icon
    Then user sees a tooltip with text "east"
    Then user sees a tooltip with text "west"
    Then user does not see any "Not" in the tooltip
    Then user does not see any "Unreachable" in the tooltip

  @multi-cluster
  @component-health-upscale
  Scenario: Istio components unhealthy
    When user scales to "0" the "grafana" in namespace "istio-system"
    Then the user refreshes the page
    Then user sees "east" cluster label with a "warning" icon
    When user hovers over the cluster icon
    Then user sees a tooltip with text "Unreachable"
    When user scales to "1" the "grafana" in namespace "istio-system"
    Then the user refreshes the page
    Then user sees "east" cluster label with a "success" icon
    When user hovers over the cluster icon
    Then user does not see any "Not" in the tooltip
    Then user does not see any "Unreachable" in the tooltip
