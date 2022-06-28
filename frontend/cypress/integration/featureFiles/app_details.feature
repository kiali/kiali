Feature: Kiali App Details page

  On the App Details page, an admin should see details about an application as well as
  a minigraph for traffic going to and originating from the application. In addition,
  there should be tabs for viewing application specific traffic, inbound/outbound metrics,
  and traces. The traces tab should show trace details about the selected trace. The spans tab
  should show span details about the selected trace.

  Background:
    Given user is at administrator perspective
    And user is at the details page for the "app" "bookinfo/details"

  @app-details-page
  Scenario: See details for app.
    Then user sees details information for app

  @app-details-page
  Scenario: See minigraph for details app.
    Then user sees a minigraph

  @app-details-page
  Scenario: See Traffic information
    Then user sees inbound and outbound traffic information

  @app-details-page
  Scenario: See Inbound Metrics
    Then user sees inbound metrics information

  @app-details-page
  Scenario: See Outbound Metrics
    Then user sees outbound metrics information

  @app-details-page
  Scenario: See tracing info after selecting a trace
    Then user sees trace information
    And user sees trace details after selecting a trace

  @app-details-page
  Scenario: See span info after selecting a span
    Then user sees trace information
    And user sees span details after selecting a trace
    And user can filter spans by app
