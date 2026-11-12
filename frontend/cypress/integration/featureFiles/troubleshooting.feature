@troubleshooting
# don't change first line of this file - the tag is used for the test scripts to identify the test suite
@skip-ossmc

Feature: Kiali Troubleshooting page

  #
  # Troubleshooting is independent of the AI master switch.
  #   - Always reachable from the left menu (/console/troubleshooting)
  #   - Overview shows a Troubleshooting card with critical/warning counts
  #   - Notification center does not surface troubleshooting problems
  #   - Resource View links appear after the issue summary in the title row
  #
  # Ask / Fix with AI kebab controls are covered by ai_dashboard.feature (flag matrix)
  # and ai_chatbot.feature (chatbot launch from a subproblem).
  #

  Background:
    Given user is at administrator perspective
    And the troubleshooting scan returns mesh problems

  Scenario: The Troubleshooting page displays detected problems and subproblems
    When user visits the Troubleshooting page
    Then the troubleshooting summary should contain "Troubleshooting: 4 problems detected"
    And the Troubleshooting page should show issue "Service productpage has errors"
    And the Troubleshooting page should show subproblem "High HTTP 5xx error rate"

  Scenario: Subproblem titles show View resource links after the issue summary
    When user visits the Troubleshooting page
    Then the Troubleshooting page should show a "View Service" link to "/namespaces/bookinfo/services/productpage"
    And the Troubleshooting page should show a "View Workload" link to "/namespaces/bookinfo/workloads/kiali-traffic-generator"
    And the Troubleshooting page should show a "View Mesh" link to "/mesh?meshKiali=true"
    And the Troubleshooting page should show a "View IstioObject" link to "/namespaces/bookinfo/istio/networking.istio.io/v1/VirtualService/reviews"
    And Istio object subproblems should not show inline Ask AI buttons

  Scenario: Hiding and showing a troubleshooting subproblem moves it between visible and hidden lists
    When user visits the Troubleshooting page
    And user hides the first troubleshooting subproblem
    Then the hidden troubleshooting problems section should be visible
    When user expands the hidden troubleshooting problems section
    And user shows the first hidden troubleshooting subproblem
    Then the hidden troubleshooting problems section should not exist

  Scenario: Troubleshooting menu and Overview card are always available
    When user visits the Troubleshooting page
    Then the Troubleshooting page should be shown
    And the Troubleshooting menu item should be visible
    When user visits the overview page
    Then the Overview Troubleshooting card should be visible
    And the Overview Troubleshooting card should show 2 critical and 2 warning
    When user clicks View Troubleshooting on the Overview card
    Then the browser should be on the Troubleshooting page

  Scenario: Notification center does not show troubleshooting problems
    When user visits the Troubleshooting page
    And user opens the notification drawer
    Then the notification drawer should be open
    And the notification drawer should not show the troubleshooting section
    And the notification badge should not show the AI icon
