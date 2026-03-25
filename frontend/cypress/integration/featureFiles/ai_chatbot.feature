@ai-chatbot
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali AI Chatbot

  The AI Chatbot should be available in the Kiali UI when AI is enabled.
  Users should be able to toggle the chatbot and interact with it.

  Background:
    Given user is at administrator perspective
    And user is at the "overview" page

  Scenario: The AI chatbot toggle button is visible
    Then the AI chatbot toggle button should be visible

  Scenario: The AI chatbot can be opened
    When user clicks the AI chatbot toggle
    Then the AI chatbot window should be open

  Scenario: The AI chatbot can be closed
    When user clicks the AI chatbot toggle
    And the AI chatbot window should be open
    And user clicks the AI chatbot toggle
    Then the AI chatbot window should be closed

  Scenario: The AI chatbot shows a welcome message
    When user clicks the AI chatbot toggle
    Then the AI chatbot window should be open
    And the AI chatbot should display a welcome message
