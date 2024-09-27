@graph-page-replay
@ossmc
@pft
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Graph page - Replay

  User opens the Graph page and replays the "alpha" and "beta" namespace traffic

  Background:
    Given user is at administrator perspective

  @error-rates-app
  Scenario: Graph alpha and beta namespaces
    When user graphs "alpha,beta" namespaces in the patternfly graph
    Then user sees the "alpha" namespace in the patternfly graph
    And user sees the "beta" namespace in the patternfly graph

  @error-rates-app
  Scenario: Show Replay
    When user presses the Replay button
    Then user sees the Replay Close button
    And user presses the Play button
    And user sees the slider
    And user presses the "fast" speed button
    And user presses the "slow" speed button
    And user presses the "medium" speed button
    And user presses the Pause button

  @error-rates-app
  Scenario: Close Replay
    When user presses the Replay Close button
    Then user no longer sees the slider
