@workload-logs
@ossmc
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
    Given I am on the "ratings-v1" workload detail page of the "bookinfo" namespace
    When I go to the Logs tab of the workload detail page
    Then I should see the "sidecar-proxy" container listed
    And I should see the "ratings" container listed
    And the "container-sidecar-proxy" container should be checked
    And the "container-ratings" container should be checked
    And I should see some "ratings-v1" pod selected in the pod selector

  @bookinfo-app
  Scenario: The log pane of the logs tab should only show the lines with the requested text
    Given I am on the logs tab of the "ratings-v1" workload detail page of the "bookinfo" namespace
    When I type "GET" on the Show text field
    Then the log pane should only show log lines containing "GET"

  @bookinfo-app
  Scenario: The log pane of the logs tab should hide the lines with the requested text
    Given I am on the logs tab of the "ratings-v1" workload detail page of the "bookinfo" namespace
    When I type "GET" on the Hide text field
    Then the log pane should only show log lines not containing "GET"

  @bookinfo-app
  Scenario: The log pane of the logs tab should limit the number of log lines that are fetched
    Given I am on the logs tab of the "ratings-v1" workload detail page of the "bookinfo" namespace
    When I choose to show 100 lines of logs
    Then the log pane should show at most 100 lines of logs of each selected container

  @bookinfo-app
  Scenario: The log pane of the logs tab should only show logs for the selected container
    Given I am on the logs tab of the "ratings-v1" workload detail page of the "bookinfo" namespace
    When I select only the "ratings" container
    Then the log pane should only show logs for the "ratings" container

  @bookinfo-app
  @ambient
  @waypoint
  Scenario: The logs tab should show the ztunnel logs for a pod
    Given I am on the "ratings-v1" workload detail page of the "bookinfo" namespace
    When I go to the Logs tab of the workload detail page
    Then I should see the "ztunnel" container listed
    And I should see the "ratings" container listed
    And I select the "ztunnel-ratings" container
    And the "ztunnel-ratings" container should be checked
    And the "container-ratings" container should be checked
    And I should see some "ratings-v1" pod selected in the pod selector
    Then the log pane should show log lines containing "ztunnel"

  @bookinfo-app
  @waypoint
  Scenario: The logs tab should show the waypoint logs for a pod
    Given I am on the "ratings-v1" workload detail page of the "bookinfo" namespace
    When I go to the Logs tab of the workload detail page
    Then I should see the "waypoint" container listed
    And I should see the "ratings" container listed
    And I select the "waypoint-ratings" container
    And the "waypoint-ratings" container should be checked
    And the "container-ratings" container should be checked
    And I should see some "ratings-v1" pod selected in the pod selector
    Then the log pane should show log lines containing "envoy://internal_client_address/"

  @bookinfo-app
  @tracing
  @waypoint-tracing
  Scenario: The log pane of the logs tab should show spans
    Given I am on the logs tab of the "ratings-v1" workload detail page of the "bookinfo" namespace
    When I enable visualization of spans
    Then the log pane should show spans
