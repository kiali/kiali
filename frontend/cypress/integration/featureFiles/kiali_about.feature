Feature: Kiali help about verify

  User wants to verify the Kiali help about information

  Background:
    Given user is at administrator perspective
    And user is at the "overview" page

  @smoke
  @core
  Scenario: Open Kiali about page
    And user clicks on Help Button
    And user clicks on About Button
    Then user see Kiali brand

  @smoke
  @core
  Scenario: Verify version information is displayed correctly
    And user clicks on Help Button
    And user clicks on About Button
    Then user see valid version information
