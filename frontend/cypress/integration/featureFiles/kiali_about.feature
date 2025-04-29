@smoke
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali help about verify

  User wants to verify the Kiali help about information

  Background:
    Given user is at administrator perspective
    And user is at the "overview" page

  # Jaeger is not available in OCP 4.19, and we don't have Tempo setup yet in LPINTEROP pipelines (will be for OSSM3+)
  @skip-lpinterop
  Scenario: Open Kiali about page

    And user clicks on Help Button
    And user clicks on About Button
    Then user see Kiali brand
