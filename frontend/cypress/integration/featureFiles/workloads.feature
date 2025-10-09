@workloads
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Workloads page

  User opens the Workloads page and sees the bookinfo workloads.

  Background:
    Given user is at administrator perspective
    And user is at the "workloads" list page

  @bookinfo-app
  @core-2
  @offline
  Scenario: See workloads table with correct info
    When user selects the "bookinfo" namespace
    Then user sees a table with headings
      | Health | Name | Namespace | Type | Labels | Details |
    And the "details-v1" row is visible
    And the health column on the "details-v1" row has a health icon
    And the "Name" column on the "details-v1" row has a link ending in "/namespaces/bookinfo/workloads/details-v1"
    And the "Namespace" column on the "details-v1" row has the text "bookinfo"
    And the "Labels" column on the "details-v1" row has the text "app=details"
    And the "Labels" column on the "details-v1" row has the text "version=v1"
    And the "Type" column on the "details-v1" row has the text "Deployment"
    And the "Details" column on the "details-v1" row does not contain "Config Issues"
    And the "Cluster" column "disappears"

  @bookinfo-app
  @core-2
  @offline
  Scenario: See all Workloads toggles
    Then user sees all the Apps toggles

  @bookinfo-app
  @core-2
  @offline
  Scenario: Toggle Workloads health toggle
    When user "unchecks" toggle "health"
    Then the "Health" column "disappears"
    When user "checks" toggle "health"
    Then the "Health" column "appears"

  @bookinfo-app
  @core-2
  @offline
  Scenario: Filter workloads table by Workloads Name
    When user selects the "bookinfo" namespace
    And user selects filter "Workload Name"
    And user filters for name "details-v1"
    Then user sees "details-v1" in the table
    And table length should be 1

  @bookinfo-app
  @core-2
  @offline
  Scenario: Filter workloads table by Workloads Type
    When user selects the "bookinfo" namespace
    And user selects filter "Workload Type"
    And user filters for workload type "StatefulSet"
    Then user sees "no workloads" in workloads table

  @bookinfo-app
  @core-2
  @offline
  Scenario: Filter workloads table by sidecar
    When user selects the "bookinfo" namespace
    And user selects filter "Istio Sidecar"
    And user filters for sidecar "Present"
    Then user sees "workloads" in workloads table

  @bookinfo-app
  @core-2
  @offline
  Scenario: Filter workloads table by Istio Config Type
    When user selects the "bookinfo" namespace
    And user selects filter "Istio Config Type"
    And user filters for istio config type "VirtualService"
    Then user sees "no workloads" in workloads table

  @bookinfo-app
  @core-2
  @offline
  Scenario: Filter workloads table by health
    When user selects the "bookinfo" namespace
    And user selects filter "Health"
    And user filters for health "Healthy"
    Then user sees "workloads" in workloads table
    And user should only see healthy workloads in workloads table

  @bookinfo-app
  @core-2
  @offline
  Scenario: Filter workloads table by App Label
    When user selects the "bookinfo" namespace
    And user selects filter "App Label"
    And user filters for app label "Present"
    Then user sees "workloads" in workloads table
    And user should only see workloads with an app label

  @bookinfo-app
  @core-2
  @offline
  Scenario: Filter workloads table by Version Label
    When user selects the "bookinfo" namespace
    And user selects filter "Version Label"
    And user filters for version "Present"
    Then user sees "workloads" in workloads table
    And user should only see workloads with a version label

  @bookinfo-app
  @core-2
  @offline
  Scenario: Filter workloads table by label
    When user selects the "bookinfo" namespace
    And user selects filter "Label"
    And user filters for label "app=details"
    Then user sees "details-v1" in the table
    And table length should be 1

  @bookinfo-app
  @core-2
  @offline
  Scenario: The healthy status of a workload is reported in the list of workloads
    Given a healthy workload in the cluster
    When user selects the "bookinfo" namespace
    Then the workload should be listed as "healthy"

  @sleep-app
  @sleep-app-scaleup-after
  @core-2
  Scenario: The idle status of a workload is reported in the list of workloads
    Given an idle sleep workload in the cluster
    When user selects the "sleep" namespace
    Then the workload should be listed as "idle"
    And the health status of the workload should be "Not Ready"

  @error-rates-app
  @core-2
  Scenario: The failing status of a workload is reported in the list of workloads
    Given a failing workload in the mesh
    When user selects the "alpha" namespace
    Then the workload should be listed as "failure"
    And the health status of the workload should be "Failure"

  @error-rates-app
  @skip-lpinterop
  @core-2
  Scenario: The degraded status of a workload is reported in the list of workloads
    Given a degraded workload in the mesh
    When user selects the "alpha" namespace
    Then the workload should be listed as "degraded"
    And the health status of the workload should be "Degraded"

  @multi-cluster
  Scenario: The column related to cluster name should be visible
    When user selects the "bookinfo" namespace
    Then the "Cluster" column "appears"
    And an entry for "east" cluster should be in the table
    And an entry for "west" cluster should be in the table

  @multi-cluster
  Scenario: Sort list by cluster column
    When user selects the "bookinfo" namespace
    And user sorts the list by column "Cluster" in "ascending" order
    Then the list is sorted by column "Cluster" in "ascending" order
    When user sorts the list by column "Cluster" in "descending" order
    Then the list is sorted by column "Cluster" in "descending" order

  # TODO: offline - ambient.
  @ambient
  @skip-ossmc
  Scenario: Out of mesh
    When user selects the "sleep" namespace
    Then user sees "Out of mesh" in the table

  @ambient-multi-primary
  @multi-cluster
  Scenario: Ambient Multi-Primary: Workloads page shows ambient workloads from both clusters
    Given user is at the "workloads" page
    When user selects "bookinfo" namespace
    Then user sees workloads from both clusters
    And user sees ambient workload indicators
