@themes
# don't change first line of this file - the tag is used for the test scripts to identify the test suite
@skip-ossmc

Feature: Kiali light and dark themes

  Users can switch color scheme (light/dark) from the masthead.
  Glass / high-contrast modes are owned by OpenShift Console on OCP 5.0
  and are not exposed in standalone Kiali (PatternFly 6.4).

  Background:
    Given user is at administrator perspective
    And user is at the "overview" page

  @smoke
  @core-1
  Scenario: User can switch between light and dark themes
    Given the theme is explicitly set to light
    Then the document should use light theme
    When the user switches to dark theme
    Then the document should use dark theme
    When the user switches to light theme
    Then the document should use light theme
