@workload-logs
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Workload logs tab
  The Logs tab of a specific workload allows to see the generated logs of
  its associated pods. If the workload is backed by more than one pod, the user
  can choose which pod to see its logs. If the pod has multiple containers, it
  is possible to view logs from all containers in a single view.

  Background:
    Given user is at administrator perspective

  @bookinfo-app
  Scenario: The logs tab should show the logs of a pod
    Given I am on the "productpage-v1" workload detail page of the "bookinfo" namespace
    When I go to the Logs tab of the workload detail page
    Then I should see the "istio-proxy" container listed
    And I should see the "productpage" container listed
    And the "istio-proxy" container should be checked
    And the "productpage" container should be checked
    And I should see some "productpage-v1" pod selected in the pod selector

  @bookinfo-app
  Scenario: The log pane of the logs tab should only show the lines with the requested text
    Given I am on the logs tab of the "productpage-v1" workload detail page of the "bookinfo" namespace
    When I type "DEBUG" on the Show text field
    Then the log pane should only show log lines containing "DEBUG"

  @bookinfo-app
  Scenario: The log pane of the logs tab should hide the lines with the requested text
    Given I am on the logs tab of the "productpage-v1" workload detail page of the "bookinfo" namespace
    When I type "DEBUG" on the Hide text field
    Then the log pane should only show log lines not containing "DEBUG"

  @bookinfo-app
  Scenario: The log pane of the logs tab should limit the number of log lines that are fetched
    Given I am on the logs tab of the "productpage-v1" workload detail page of the "bookinfo" namespace
    When I choose to show 100 lines of logs
    Then the log pane should show at most 100 lines of logs of each selected container

  @bookinfo-app
  Scenario: The log pane of the logs tab should only show logs for the selected container
    Given I am on the logs tab of the "productpage-v1" workload detail page of the "bookinfo" namespace
    When I select only the "productpage" container
    Then the log pane should only show logs for the "productpage" container

  # Jaeger is not available in OCP 4.19, and we don't have Tempo setup yet in LPINTEROP pipelines (will be for OSSM3+)
  @skip-lpinterop
  @bookinfo-app
  Scenario: The log pane of the logs tab should show spans
    Given I am on the logs tab of the "productpage-v1" workload detail page of the "bookinfo" namespace
    When I enable visualization of spans
    Then the log pane should show spans
