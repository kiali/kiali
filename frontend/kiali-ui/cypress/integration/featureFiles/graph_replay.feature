Feature: Kiali Graph page - Replay

  User opens the Graph page and replays the "alpha" and "beta" namespace traffic

  Background:
    Given user is at administrator perspective

@graph-page-replay
Scenario: Graph alpha and beta namespaces
  When user graphs "alpha,beta" namespaces
  Then user sees the "alpha" namespace
  And user sees the "beta" namespace

@graph-page-replay
Scenario: Show Replay
  When user presses the Replay button
  Then user sees the Replay Close button
  And user presses the Play button
  And user sees the slider
  And user presses the "fast" speed button
  And user presses the "slow" speed button
  And user presses the "medium" speed button
  And user presses the Pause button

@graph-page-replay
Scenario: Close Replay
  When user presses the Replay Close button
  Then user no longer sees the slider
