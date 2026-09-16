@themes
# don't change first line of this file - the tag is used for the test scripts to identify the test suite
@skip-ossmc

Feature: Kiali appearance settings

  Users can switch color scheme (light/dark), theme (default/project felt), and contrast mode
  (default/glass/high contrast) from the masthead in standalone Kiali. OSSMC continues to own
  appearance classes on <html>.

  Background:
    Given user is at administrator perspective
    And user is at the "overview" page

  @smoke
  @core-1
  Scenario: User can switch between light and dark color schemes
    Given the color scheme is explicitly set to light
    Then the document should use light color scheme
    When the user switches to dark color scheme
    Then the document should use dark color scheme
    When the user switches to light color scheme
    Then the document should use light color scheme

  @core-1
  Scenario: User can switch contrast modes
    Given the color scheme is explicitly set to light
    When the user selects glass contrast mode
    Then the document should use glass contrast mode
    When the user selects high contrast mode
    Then the document should use high contrast mode
    When the user selects default contrast mode
    Then the document should use default contrast mode

  @core-1
  Scenario: User can switch between default and project felt themes
    Given the color scheme is explicitly set to light
    Then the document should use default theme
    When the user selects project felt theme
    Then the document should use project felt theme
    When the user selects default theme
    Then the document should use default theme
