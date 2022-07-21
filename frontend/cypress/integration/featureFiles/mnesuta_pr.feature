Feature: Kiali Graph page - Find/Hide 

  Just a little suit for my PR involving logging in, visiting the graph page,
  typing something random into the find form and then expecting an error message to pop up.

  Background:
    Given user is at administrator perspective
    And user graphs "bookinfo" namespaces

  @graph-page-nonsense-fill
  Scenario: Filling the find form with nonsense
    When user fills "hello world" in find and submits
    Then user sees the "Find: No valid operator found in expression" message 
