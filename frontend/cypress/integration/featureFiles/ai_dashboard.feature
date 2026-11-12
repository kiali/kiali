@ai-chatbot
# don't change first line of this file - the tag is used for the test scripts to identify the test suite
@ai
@ai-dashboard
@skip-ossmc

Feature: Kiali AI Dashboard configuration matrix

  #
  # Behaviour rules driven by /api/config.ai.* flags
  # -------------------------------------------------
  # Master switch:
  #   ai.enabled=false
  #     -> /console/ai redirects to Overview
  #     -> no AI dashboard tabs
  #
  # Tabs (visible only when the feature is enabled):
  #   ai.chat.enabled=true                -> AI User Usage tab
  #   ai.consumption.enabled=true         -> Consumption tab
  #   Troubleshooting lives on /console/troubleshooting (see troubleshooting.feature)
  #
  # Troubleshooting AI actions menu (wrench kebab on /troubleshooting):
  #   ai.enabled=false OR chat.enabled=false
  #     -> AI actions menu is hidden
  #   chat.enabled=true, chat.allowed=false
  #     -> AI actions menu stays visible but disabled (tooltip: not allowed)
  #   chat.enabled=true, chat.allowed=true
  #     -> AI actions menu enabled with Ask AI / Fix it with AI items
  #
  # Allow-list (feature enabled but user not allowed):
  #   chat.enabled=true, chat.allowed=false
  #     -> AI User Usage tab still visible
  #     -> Current session area shows "Chat disabled (current session)"
  #     -> Chatbot FAB stays visible but cannot open (tooltip: not allowed)
  #   consumption.enabled=true, consumption.allowed=false
  #     -> Consumption tab stays visible but is aria-disabled
  #
  # Historic metrics on AI User Usage:
  #   Driven by consumption.enabled (metrics feature), independent of chat.allowed.
  #   chat.allowed=false + consumption.enabled=true
  #     -> Current session = chat-disabled message
  #     -> Current week / historic charts still load and show
  #   chat.allowed=false + consumption.enabled=false
  #     -> Current session = chat-disabled message only (no historic section)
  #
  # Chatbot FAB:
  #   Rendered when ai.enabled && chat.enabled.
  #   Opens only when chat.allowed=true.
  #

  Background:
    Given user is at administrator perspective
    And the troubleshooting scan returns mesh problems

  # ---------------------------------------------------------------------------
  # ai.enabled = false
  # ---------------------------------------------------------------------------

  Scenario: AI disabled redirects the AI dashboard deep link to overview
    # Deep links must not leave the user on a broken AI page when AI is off.
    # Troubleshooting page stays reachable, but the AI actions menu is hidden.
    Given AI dashboard features are configured with
      | feature      | enabled | allowed |
      | ai           | false   |         |
      | chat         | false   | false   |
      | consumption  | false   | false   |
    When user visits the AI dashboard
    Then the browser should be on the overview page
    And the AI chatbot toggle should not exist
    And the Troubleshooting menu item should be visible
    And the notification badge should not show the AI icon
    When user visits the Troubleshooting page
    Then the AI actions menu on troubleshooting problems should not exist

  # ---------------------------------------------------------------------------
  # ai.enabled only (chat off, consumption off)
  # ---------------------------------------------------------------------------

  Scenario: AI enabled alone with no chat or consumption redirects away from AI Dashboard
    # Troubleshooting is a separate page. With no User Usage / Consumption tabs left,
    # /console/ai has nothing to show and redirects to Overview.
    # Chat off -> AI actions menu is hidden on the Troubleshooting page.
    Given AI dashboard features are configured with
      | feature      | enabled | allowed |
      | ai           | true    |         |
      | chat         | false   | false   |
      | consumption  | false   | false   |
    When user visits the AI dashboard
    Then the browser should be on the overview page
    And the AI dashboard AI User Usage tab should not exist
    And the AI dashboard Consumption tab should not exist
    And the AI chatbot toggle should not exist
    When user visits the Troubleshooting page
    Then the AI actions menu on troubleshooting problems should not exist

  # ---------------------------------------------------------------------------
  # consumption.enabled (chat off)
  # ---------------------------------------------------------------------------

  Scenario: Consumption enabled and allowed shows an enabled Consumption tab
    # Consumption is independent of chat. User Usage stays hidden while chat is off.
    Given AI dashboard features are configured with
      | feature      | enabled | allowed |
      | ai           | true    |         |
      | chat         | false   | false   |
      | consumption  | true    | true    |
    When user visits the AI dashboard
    Then the AI dashboard Consumption tab should be visible
    And the AI dashboard Consumption tab should be enabled
    And the AI dashboard AI User Usage tab should not exist
    When user visits the AI dashboard on the "consumption" tab
    Then the AI Consumption page should be shown

  Scenario: Consumption enabled but not allowed keeps the tab visible and disabled
    # Allow-list denial must not hide the tab; it only disables selection.
    Given AI dashboard features are configured with
      | feature      | enabled | allowed |
      | ai           | true    |         |
      | chat         | false   | false   |
      | consumption  | true    | false   |
    When user visits the AI dashboard
    Then the AI dashboard Consumption tab should be visible
    And the AI dashboard Consumption tab should be disabled
    And the AI dashboard AI User Usage tab should not exist

  # ---------------------------------------------------------------------------
  # chat.enabled (consumption off)
  # ---------------------------------------------------------------------------

  Scenario: Chat enabled and allowed shows User Usage with enabled problem AI actions
    # Chat on -> User Usage tab + chatbot FAB + AI actions menu enabled on Troubleshooting page.
    # Consumption off -> no Consumption tab and no historic metrics on User Usage.
    Given AI dashboard features are configured with
      | feature      | enabled | allowed |
      | ai           | true    |         |
      | chat         | true    | true    |
      | consumption  | false   | false   |
    When user visits the AI dashboard
    Then the AI dashboard AI User Usage tab should be visible
    And the AI dashboard Consumption tab should not exist
    And the AI chatbot toggle should be visible
    When user visits the Troubleshooting page
    Then the AI actions menu on troubleshooting problems should be enabled
    And the AI actions menu should include Ask AI and Fix it with AI
    When user visits the AI dashboard on the "session-usage" tab
    Then the AI User Usage page should show the current session area
    And the AI User Usage page should not show historic metrics
    And the AI User Usage page should not show chat disabled for the current session

  Scenario: Chat enabled but not allowed disables chat controls and shows session disabled state
    # User is on the allow-list deny path: tabs stay, actions are disabled.
    # Consumption off -> only the Current session chat-disabled message (no historic charts).
    Given AI dashboard features are configured with
      | feature      | enabled | allowed |
      | ai           | true    |         |
      | chat         | true    | false   |
      | consumption  | false   | false   |
    When user visits the AI dashboard
    Then the AI dashboard AI User Usage tab should be visible
    And the AI dashboard Consumption tab should not exist
    And the AI chatbot toggle should be visible
    And the AI chatbot toggle tooltip should say "Chatbot is not allowed for this user"
    When user visits the AI dashboard on the "session-usage" tab
    Then the AI User Usage page should show chat disabled for the current session
    And the AI User Usage page should not show historic metrics
    When user visits the Troubleshooting page
    Then the AI actions menu on troubleshooting problems should be disabled

  # ---------------------------------------------------------------------------
  # chat + consumption both enabled
  # ---------------------------------------------------------------------------

  Scenario: All AI features enabled and allowed shows every tab with active controls
    Given AI dashboard features are configured with
      | feature      | enabled | allowed |
      | ai           | true    |         |
      | chat         | true    | true    |
      | consumption  | true    | true    |
    When user visits the AI dashboard
    Then the AI dashboard AI User Usage tab should be visible
    And the AI dashboard Consumption tab should be visible
    And the AI dashboard Consumption tab should be enabled
    And the AI chatbot toggle should be visible
    When user visits the Troubleshooting page
    Then the AI actions menu on troubleshooting problems should be enabled
    And the AI actions menu should include Ask AI and Fix it with AI
    When user visits the AI dashboard on the "session-usage" tab
    Then the AI User Usage page should show the current session area
    And the AI User Usage page should show historic metrics
    And the AI User Usage page should not show chat disabled for the current session
    When user visits the AI dashboard on the "consumption" tab
    Then the AI Consumption page should be shown

  Scenario: Chat not allowed still shows historic User Usage when consumption is enabled
    # Historic Prometheus metrics on User Usage follow consumption.enabled, not chat.allowed.
    # Current session stays blocked; AI actions stay disabled; Consumption remains usable.
    Given AI dashboard features are configured with
      | feature      | enabled | allowed |
      | ai           | true    |         |
      | chat         | true    | false   |
      | consumption  | true    | true    |
    When user visits the AI dashboard
    Then the AI dashboard AI User Usage tab should be visible
    And the AI dashboard Consumption tab should be visible
    And the AI dashboard Consumption tab should be enabled
    And the AI chatbot toggle should be visible
    And the AI chatbot toggle tooltip should say "Chatbot is not allowed for this user"
    When user visits the AI dashboard on the "session-usage" tab
    Then the AI User Usage page should show chat disabled for the current session
    And the AI User Usage page should show historic metrics
    When user visits the Troubleshooting page
    Then the AI actions menu on troubleshooting problems should be disabled
    When user visits the AI dashboard on the "consumption" tab
    Then the AI Consumption page should be shown

  Scenario: Chat allowed but consumption not allowed shows User Usage historic and a disabled Consumption tab
    # Consumption deny-list only disables the Consumption tab.
    # User Usage historic charts still appear because consumption.enabled remains true.
    Given AI dashboard features are configured with
      | feature      | enabled | allowed |
      | ai           | true    |         |
      | chat         | true    | true    |
      | consumption  | true    | false   |
    When user visits the AI dashboard
    Then the AI dashboard AI User Usage tab should be visible
    And the AI dashboard Consumption tab should be visible
    And the AI dashboard Consumption tab should be disabled
    When user visits the AI dashboard on the "session-usage" tab
    Then the AI User Usage page should show the current session area
    And the AI User Usage page should show historic metrics
    And the AI User Usage page should not show chat disabled for the current session
    When user visits the Troubleshooting page
    Then the AI actions menu on troubleshooting problems should be enabled
    And the AI actions menu should include Ask AI and Fix it with AI
