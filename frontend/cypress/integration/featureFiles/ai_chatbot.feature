@ai-chatbot
# don't change first line of this file - the tag is used for the test scripts to identify the test suite
@skip-ossmc

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

  Scenario: The AI chatbot responds with sources
    When user clicks the AI chatbot toggle
    And the AI chatbot window should be open
    And user sends a message "Could you explain what a VirtualService is and point me to the relevant documentation?"
    Then the AI chatbot should display a sources card

  Scenario: The AI chatbot responds with a single navigation action
    When user clicks the AI chatbot toggle
    And the AI chatbot window should be open
    And the always navigate switch should be unchecked
    And user sends a message with actions "Please show my services in the namespace bookinfo"
    Then the AI chatbot should display the answer "I'm taking you to the services list for the bookinfo namespace now."
    And the navigation actions container should be visible with 1 links

  Scenario: The AI chatbot responds with multiple navigation actions
    When user clicks the AI chatbot toggle
    And the AI chatbot window should be open
    And the always navigate switch should be unchecked
    And user sends a message with multiple actions "Please show my services in the namespace bookinfo"
    Then the AI chatbot should display the answer "I'm taking you to the services list for the bookinfo namespace now."
    And the navigation actions container should be visible with 2 links

  Scenario: The AI chatbot auto-navigates when always navigate is enabled
    When user clicks the AI chatbot toggle
    And the AI chatbot window should be open
    And user enables the always navigate switch
    And user sends a message with auto navigate "Can you navigate to services in bookinfo ?"
    Then the AI chatbot should display the answer "Sure, I can navigate you to the services in the bookinfo namespace."
    And the navigation actions container should not be visible
    And the URL should contain "/services?namespaces=bookinfo"

  Scenario: The AI chatbot YAML attachment triggers Istio VirtualService create
    Given there is not a "vs-ai-cypress" "VirtualService" in the "bookinfo" namespace
    When user clicks the AI chatbot toggle
    And the AI chatbot window should be open
    And user sends a message with YAML create action "Create a VirtualService for reviews in bookinfo"
    Then the AI chatbot should display the answer "Here is a VirtualService you can create in bookinfo."
    When user opens the chatbot YAML attachment "vs-ai-cypress.yaml"
    And user confirms YAML create in the chatbot modal
    Then the Istio YAML apply request should succeed with method "POST"
    And the AI chatbot should show YAML apply success for "create"
    When user views the Istio Config list for namespaces "bookinfo"
    Then user sees VirtualService "vs-ai-cypress" in the Istio Config list

  Scenario: The AI chatbot YAML attachment triggers Istio VirtualService patch
    Given there is a "vs-ai-cypress" VirtualService in the "bookinfo" namespace with a "main" http-route to host "reviews"
    When user clicks the AI chatbot toggle
    And the AI chatbot window should be open
    And user sends a message with YAML patch action "Patch the reviews VirtualService timeout in bookinfo"
    Then the AI chatbot should display the answer "Apply this patch to the existing VirtualService."
    When user opens the chatbot YAML attachment "vs-ai-cypress.yaml"
    And user confirms YAML patch in the chatbot modal
    Then the Istio YAML apply request should succeed with method "PATCH"
    And the AI chatbot should show YAML apply success for "patch"
    When user opens Istio Config details for VirtualService "vs-ai-cypress" in namespace "bookinfo"
    Then the Istio config YAML editor should contain "timeout: 2s"

  Scenario: The AI chatbot YAML attachment triggers Istio VirtualService delete
    Given there is a "vs-ai-cypress" VirtualService in the "bookinfo" namespace with a "main" http-route to host "reviews"
    When user clicks the AI chatbot toggle
    And the AI chatbot window should be open
    And user sends a message with YAML delete action "Delete the reviews VirtualService in bookinfo"
    Then the AI chatbot should display the answer "Confirm deletion of this VirtualService."
    When user opens the chatbot YAML attachment "vs-ai-cypress.yaml"
    And user confirms YAML delete in the chatbot modal
    Then the Istio YAML apply request should succeed with method "DELETE"
    And the AI chatbot should show YAML apply success for "delete"
    When user views the Istio Config list for namespaces "bookinfo"
    Then user does not see VirtualService "vs-ai-cypress" in the Istio Config list
