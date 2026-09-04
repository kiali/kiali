@themes
# don't change first line of this file - the tag is used for the test scripts to identify the test suite
@skip-ossmc

Feature: Kiali light and dark themes

  Users can switch color scheme (light/dark) and contrast mode (default/glass/high contrast)
  from the masthead in standalone Kiali. OSSMC continues to own theme classes on <html>.

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

  @smoke
  @core-1
  Scenario: User can switch contrast modes
    Given the theme is explicitly set to light
    When the user selects glass contrast mode
    Then the document should use glass contrast mode
    When the user selects high contrast mode
    Then the document should use high contrast mode
    When the user selects default contrast mode
    Then the document should use default contrast mode
