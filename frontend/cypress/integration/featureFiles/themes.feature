@themes
# don't change first line of this file - the tag is used for the test scripts to identify the test suite
@skip-ossmc

Feature: Kiali theme and contrast modes

  Users can switch color scheme (light/dark) and contrast mode
  (default/glass/high contrast) from the masthead.

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
  Scenario: User can enable glass contrast mode
    Given the theme is explicitly set to light
    And the contrast mode is explicitly set to default
    When the user switches to glass contrast mode
    Then the document should use glass contrast mode
    And the document should not use high contrast mode

  @core-1
  Scenario: High contrast disables glass
    Given the theme is explicitly set to light
    And the contrast mode is explicitly set to default
    When the user switches to glass contrast mode
    Then the document should use glass contrast mode
    When the user switches to high contrast mode
    Then the document should use high contrast mode
    And the document should not use glass contrast mode

  @core-1
  Scenario: User can return to default contrast mode
    Given the contrast mode is explicitly set to default
    When the user switches to high contrast mode
    Then the document should use high contrast mode
    When the user switches to default contrast mode
    Then the document should use default contrast mode
