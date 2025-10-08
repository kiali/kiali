@app-details
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali App Details page

  On the App Details page, an admin should see details about an application as well as
  a minigraph for traffic going to and originating from the application. In addition,
  there should be tabs for viewing application specific traffic, inbound/outbound metrics,
  and traces. The traces tab should show trace details about the selected trace. The spans tab
  should show span details about the selected trace.

  Background:
    Given user is at administrator perspective
    And user is at the details page for the "app" "bookinfo/details" located in the "" cluster

  @bookinfo-app
  @core-1
  @offline
  Scenario: See details for app.
    Then user sees details information for the "details" app
    But no cluster badge for the "app" should be visible

  @bookinfo-app
  @core-1
  Scenario: See app Traffic information
    Then user sees inbound and outbound traffic information
    And the "Cluster" column "disappears"

  @bookinfo-app
  @core-1
  @offline
  Scenario: See Inbound Metrics
    Then user sees inbound metrics information

  @bookinfo-app
  @core-1
  @offline
  Scenario: See Outbound Metrics
    Then user sees outbound metrics information

  @bookinfo-app
  @tracing
  @waypoint-tracing
  @skip-ossmc
  Scenario: See tracing info after selecting a trace
    And user sees trace information
    When user selects a trace
    Then user sees trace details

  @bookinfo-app
  @tracing
  Scenario: See span info after selecting app span
    And user sees trace information
    When user selects a trace with at least 6 spans
    Then user sees span details
    And user can filter spans by app "productpage"

  @waypoint-tracing
  @skip-ossmc
  Scenario: See span info after selecting app span
    And user sees trace information
    When user selects a trace with at least 4 spans
    Then user sees span details
    And user can filter spans by app "waypoint"
