Feature: Workload logs tab
  The Logs tab of a specific workload allows to see the generated logs of
  its associated pods. If the workload is backed by more than one pod, the user
  can choose which pod to see its logs. If the pod has multiple containers, it
  is possible to view logs from all containers in a single view.

  Background:
    Given I open Kiali URL
    Given user is at administrator perspective

  Scenario: The logs tab should show the logs of a pod
    Given I am on the "productpage-v1" workload detail page
    When I go to the Logs tab of the workload detail page
    Then I should see the "istio-proxy" container listed
    And I should see the "productpage" container listed
    And the "istio-proxy" container should be checked
    And the "productpage" container should be checked
    And I should see some "productpage-v1" pod selected in the pod selector
