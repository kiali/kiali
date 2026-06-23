@ai-chatbot
# don't change first line of this file - the tag is used for the test scripts to identify the test suite
@skip-ossmc

Feature: Kiali AI Chatbot

  The AI Chatbot should be available in the Kiali UI when AI is enabled.
  Users should be able to toggle the chatbot and interact with it.

  Background:
    Given user is at administrator perspective
    And user is at the "overview" page

  Scenario: Changing display mode updates the chatbot layout class and CSS variables
    When user clicks the AI chatbot toggle
    And the AI chatbot window should be open
    And the user clicks the "Dock to window" header button
    Then the chatbot should be in "docked" display mode
    And the chatbot docked height CSS variable should be set
    When the user clicks the "Overlay" header button
    Then the chatbot should be in "default" display mode

  Scenario: The Minimize button hides the chatbot
    When user clicks the AI chatbot toggle
    And the AI chatbot window should be open
    And the user clicks the "Minimize" header button
    Then the AI chatbot window should be closed

  Scenario: The chatbot toggle icon reflects the active theme
    Given the theme is explicitly set to light
    Then the AI chatbot toggle should show the light theme icon
    When the user switches to dark theme
    Then the AI chatbot toggle should show the dark theme icon
    When the user switches to light theme
    Then the AI chatbot toggle should show the light theme icon

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

  Scenario: The AI chatbot shows a cancelled alert when the user stops the stream
    When user clicks the AI chatbot toggle
    And the AI chatbot window should be open
    And user sends a message that starts streaming "Tell me about Istio"
    And the AI chatbot stop button should be visible
    When user clicks the stop button
    Then the AI chatbot should show a cancelled alert

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

  Scenario: The New Chat button opens the confirmation modal
    When user clicks the AI chatbot toggle
    And the AI chatbot window should be open
    And user sends a message "Hello, this is a test message"
    And the AI chatbot should display the answer "Of course."
    When user clicks the new chat button
    Then the new chat confirmation modal should be open

  Scenario: The new chat modal shows the erase conversation message when opened from the new chat button
    When user clicks the AI chatbot toggle
    And the AI chatbot window should be open
    When user clicks the new chat button
    Then the new chat confirmation modal should be open
    And the new chat modal should show the erase conversation message

  Scenario: The new chat modal shows the provider change message when opened by selecting a different provider
    Given two AI providers are configured
    When user clicks the AI chatbot toggle
    And the AI chatbot window should be open
    And user sends a message "Hello, this is a test message"
    And the AI chatbot should display the answer "Of course."
    When user selects the second AI provider
    Then the new chat confirmation modal should be open
    And the new chat modal should show the provider change message

  Scenario: Cancelling the new chat modal keeps the conversation intact
    When user clicks the AI chatbot toggle
    And the AI chatbot window should be open
    And user sends a message "Hello, this is a test message"
    And the AI chatbot should display the answer "Of course."
    When user clicks the new chat button
    And the new chat confirmation modal should be open
    And user cancels the new chat modal
    Then the new chat modal should be closed
    And the AI chatbot should still contain the message "Of course."

  Scenario: Closing the new chat modal with X keeps the conversation intact
    When user clicks the AI chatbot toggle
    And the AI chatbot window should be open
    And user sends a message "Hello, this is a test message"
    And the AI chatbot should display the answer "Of course."
    When user clicks the new chat button
    And the new chat confirmation modal should be open
    And user closes the new chat modal with X
    Then the new chat modal should be closed
    And the AI chatbot should still contain the message "Of course."

  Scenario: Confirming a new chat clears the conversation and resets the session
    When user clicks the AI chatbot toggle
    And the AI chatbot window should be open
    And user sends a message "Hello, this is a test message"
    And the AI chatbot should display the answer "Of course."
    When user clicks the new chat button
    And the new chat confirmation modal should be open
    And user confirms the new chat modal
    Then the new chat modal should be closed
    And the AI chatbot window should be open
    And the AI chatbot should display a welcome message
    And the AI chatbot should not contain the message "Of course."
    And the next chat message should be sent without a conversation ID

  Scenario: Selecting a different AI provider opens the new chat confirmation modal
    Given two AI providers are configured
    When user clicks the AI chatbot toggle
    And the AI chatbot window should be open
    And user sends a message "Hello, this is a test message"
    And the AI chatbot should display the answer "Of course."
    When user selects the second AI provider
    Then the new chat confirmation modal should be open

  Scenario: Confirming a provider change updates the selected provider and clears the chat
    Given two AI providers are configured
    When user clicks the AI chatbot toggle
    And the AI chatbot window should be open
    And user sends a message "Hello, this is a test message"
    And the AI chatbot should display the answer "Of course."
    When user selects the second AI provider
    And the new chat confirmation modal should be open
    And user confirms the new chat modal
    Then the new chat modal should be closed
    And the AI chatbot should display a welcome message
    And the AI chatbot should not contain the message "Of course."
    And the AI chatbot header should show the second provider as selected
    And the next chat message should be sent to the second AI provider without a conversation ID

  Scenario: Selecting a different AI provider opens the new chat confirmation modal
    Given two AI providers are configured
    When user clicks the AI chatbot toggle
    And the AI chatbot window should be open
    And user sends a message "Hello, this is a test message"
    And the AI chatbot should display the answer "Of course."
    When user selects the second AI provider
    Then the new chat confirmation modal should be open

  Scenario: Confirming a provider change updates the selected provider and clears the chat
    Given two AI providers are configured
    When user clicks the AI chatbot toggle
    And the AI chatbot window should be open
    And user sends a message "Hello, this is a test message"
    And the AI chatbot should display the answer "Of course."
    When user selects the second AI provider
    And the new chat confirmation modal should be open
    And user confirms the new chat modal
    Then the new chat modal should be closed
    And the AI chatbot should display a welcome message
    And the AI chatbot should not contain the message "Of course."
    And the AI chatbot header should show the second provider as selected
    And the next chat message should be sent to the second AI provider without a conversation ID

  Scenario: The AI chatbot renders a tool call label while the tool is running
    When user clicks the AI chatbot toggle
    And the AI chatbot window should be open
    And user sends a message triggering a running tool "What is the mesh status?"
    Then the AI chatbot should show a running tool label for "get_mesh_status"

  Scenario: The AI chatbot renders a completed tool call with success icon
    When user clicks the AI chatbot toggle
    And the AI chatbot window should be open
    And user sends a message triggering a successful tool "What is the mesh status?"
    Then the AI chatbot should show a completed tool label for "get_mesh_status"

  Scenario: The AI chatbot renders a failed tool call with error icon
    When user clicks the AI chatbot toggle
    And the AI chatbot window should be open
    And user sends a message triggering a failed tool "Get the application logs"
    Then the AI chatbot should show an error tool label for "get_logs"

  Scenario: The AI chatbot tool modal shows pending state when tool is still running
    When user clicks the AI chatbot toggle
    And the AI chatbot window should be open
    And user sends a message triggering a running tool "What is the mesh status?"
    And the AI chatbot should show a running tool label for "get_mesh_status"
    When user clicks the tool label for "get_mesh_status"
    Then the AI chatbot tool modal should be open
    And the AI chatbot tool modal should show "pending" status

  Scenario: The AI chatbot tool modal shows result content after tool completion
    When user clicks the AI chatbot toggle
    And the AI chatbot window should be open
    And user sends a message triggering a successful tool "What is the mesh status?"
    And the AI chatbot should show a completed tool label for "get_mesh_status"
    When user clicks the tool label for "get_mesh_status"
    Then the AI chatbot tool modal should be open
    And the AI chatbot tool modal should show "success" status
    And the AI chatbot tool modal should display tool output content

  Scenario: The AI chatbot tool modal displays tool arguments
    When user clicks the AI chatbot toggle
    And the AI chatbot window should be open
    And user sends a message triggering a tool with arguments "List services in bookinfo"
    And the AI chatbot should show a completed tool label for "list_or_get_resources"
    When user clicks the tool label for "list_or_get_resources"
    Then the AI chatbot tool modal should be open
    And the AI chatbot tool modal should display tool arguments containing "namespaces=bookinfo"

  Scenario: The AI chatbot renders multiple file attachments when the end event contains multiple actions
    When user clicks the AI chatbot toggle
    And the AI chatbot window should be open
    And user sends a message with multiple file actions "Apply traffic shifting for the reviews service"
    Then the AI chatbot should display the file attachment label "dr_reviews"
    And the AI chatbot should display the file attachment label "vs_reviews"

  Scenario: The AI chatbot file attachment modal shows the YAML content and can be dismissed
    When user clicks the AI chatbot toggle
    And the AI chatbot window should be open
    And user sends a message with multiple file actions "Apply traffic shifting for the reviews service"
    When user opens the chatbot YAML attachment "dr_reviews.yaml"
    Then the chatbot YAML attachment modal should be open
    And the chatbot YAML attachment modal should contain "DestinationRule" in the editor
    When user closes the chatbot YAML attachment modal
    Then the chatbot YAML attachment modal should be closed

  Scenario: The AI chatbot file attachment create button calls the API and adds a success message
    When user clicks the AI chatbot toggle
    And the AI chatbot window should be open
    And user sends a message with multiple file actions "Apply traffic shifting for the reviews service"
    When user opens the chatbot YAML attachment "dr_reviews.yaml"
    And user confirms YAML create for the DestinationRule attachment
    Then the Istio YAML apply request should succeed with method "POST"
    And the AI chatbot should contain the text "Successfully created"
    And the chatbot YAML attachment modal should be closed

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

  Scenario: The AI chatbot defaults to ask mode
    When user clicks the AI chatbot toggle
    Then the AI chatbot window should be open
    And the interaction mode should be "ask"
    And the message input placeholder should say "Ask a question..."

  Scenario: The user can switch from ask mode to troubleshoot mode
    When user clicks the AI chatbot toggle
    And the AI chatbot window should be open
    And the interaction mode should be "ask"
    When the user opens the interaction mode dropdown
    And the user selects "troubleshoot" interaction mode
    Then the interaction mode should be "troubleshoot"
    And the message input placeholder should say "Describe the issue..."

  Scenario: The user can switch from troubleshoot mode to ask mode
    When user clicks the AI chatbot toggle
    And the AI chatbot window should be open
    When the user opens the interaction mode dropdown
    And the user selects "troubleshoot" interaction mode
    And the interaction mode should be "troubleshoot"
    When the user opens the interaction mode dropdown
    And the user selects "ask" interaction mode
    Then the interaction mode should be "ask"
    And the message input placeholder should say "Ask a question..."

  Scenario: The interaction mode is sent with chat requests
    When user clicks the AI chatbot toggle
    And the AI chatbot window should be open
    When the user opens the interaction mode dropdown
    And the user selects "troubleshoot" interaction mode
    And user sends a message "What is wrong with my services?"
    Then the AI chatbot should display the answer "Of course."

  Scenario: The interaction mode persists after closing and reopening the chatbot
    When user clicks the AI chatbot toggle
    And the AI chatbot window should be open
    When the user opens the interaction mode dropdown
    And the user selects "troubleshoot" interaction mode
    And the interaction mode should be "troubleshoot"
    And user clicks the AI chatbot toggle
    Then the AI chatbot window should be closed
    When user clicks the AI chatbot toggle
    Then the AI chatbot window should be open
    And the interaction mode should be "troubleshoot"
    And the message input placeholder should say "Describe the issue..."

  Scenario: The interaction mode dropdown shows both ask and troubleshoot options
    When user clicks the AI chatbot toggle
    And the AI chatbot window should be open
    When the user opens the interaction mode dropdown
    Then the interaction mode dropdown should show "ask" option
    And the interaction mode dropdown should show "troubleshoot" option
    And the interaction mode dropdown should show "Standard question and answer" description
    And the interaction mode dropdown should show "Focused troubleshooting assistance" description
