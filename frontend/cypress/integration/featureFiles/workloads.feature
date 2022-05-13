Feature: Kiali Workloads page
  
  User opens the Workloads page and sees the bookinfo workloads.

  Background:
    Given user is at administrator perspective
    And user is at the "workloads" page
    And user selects the "bookinfo" namespace

  @workloads-page
  Scenario: See a table with correct info
    Then user sees a table with headings
      | Health | Name | Namespace | Type | Labels | Details |
    And the "details-v1" row is visible
    And the health column on the "details-v1" row has a health icon
    And the "Name" column on the "details-v1" row has a link ending in "/namespaces/bookinfo/workloads/details-v1"
    And the "Namespace" column on the "details-v1" row has the text "bookinfo"
    And the "Labels" column on the "details-v1" row has the text "app=details"
    And the "Labels" column on the "details-v1" row has the text "version=v1"
    And the "Type" column on the "details-v1" row has the text "Deployment"
    And the "Details" column on the "details-v1" row is empty

  @workloads-page
  Scenario: Filter workloads table by Workloads Name 
    When user selects filter "Workload Name"
    And user filters for name "details-v1"
    Then user sees "details-v1" in the table
    And table length should be 1

  @workloads-page
  Scenario: Filter workloads table by Workloads Type
    When user selects filter "Workload Type"
    And user filters for workload type "StatefulSet"
    Then user sees "no workloads" in workloads table    

  @workloads-page
  Scenario: Filter workloads table by sidecar
    When user selects filter "Istio Sidecar"
    And user filters for sidecar "Present"
    Then user sees "workloads" in workloads table

 @workloads-page
  Scenario: Filter workloads table by Istio Type
    When user selects filter "Istio Type"
    And user filters for istio type "VirtualService"    
    Then user sees "no workloads" in workloads table
  
  @workloads-page
  Scenario: Filter workloads table by health
    When user selects filter "Health"
    And user filters for health "Healthy"
    Then user sees "workloads" in workloads table
    And user should only see healthy workloads in workloads table

  @workloads-page
  Scenario: Filter workloads table by label
    When user selects filter "Label"
    And user filters for label "app=details"
    Then user sees "details-v1" in the table
    And table length should be 1
