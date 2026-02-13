@overview
@selected
Feature: New Overview - Overview cards

  Background:
    Given user is at administrator perspective

  @core-2
  Scenario: View all warning Istio configs includes namespaces and filters
    Given Istio configs API returns at least 4 warning configs
    And user is at the "overview" page
    When user opens the Istio configs warnings popover
    And user clicks the "View warning Istio configs" popover action
    Then user is redirected to Istio config list with all namespaces and warning filters

  # Combined loading/error state tests for all overview cards
  @core-2
  Scenario: All overview cards show loading state without count or footer link
    Given all overview APIs respond slowly
    And user is at the "overview" page
    Then Control planes card shows loading state without count or footer link
    And Clusters card shows loading state without count or footer link

  @core-2
  Scenario: All overview cards show error state with Try Again without count or footer link
    Given all overview APIs fail
    And user is at the "overview" page
    Then Control planes card shows error state without count or footer link
    And Clusters card shows error state without count or footer link

  # Control planes card specific tests
  @core-2
  Scenario: Control planes card can retry after error
    Given Control planes API fails
    And user is at the "overview" page
    Then Control planes card shows error state without count or footer link
    When Control planes API succeeds with 1 healthy control plane
    And user clicks Try Again in Control planes card
    Then Control planes card shows count 1 and footer link

  @core-2
  Scenario: Control plane links in popover navigate to Mesh page with cluster filter
    Given Control planes API returns 1 unhealthy control plane in cluster "Kubernetes"
    And user is at the "overview" page
    When user opens the Control planes issues popover
    And user clicks the "istiod-kubernetes" control plane link in the popover
    Then user is redirected to Mesh page with cluster filter "Kubernetes"

  @core-2
  Scenario: Data planes footer link navigates to Namespaces list with type filter
    Given user is at the "overview" page
    When user clicks View Data planes in Data planes card
    Then user is redirected to Namespaces page with data-plane type filter
    
  # Clusters card specific tests
  @core-2
  Scenario: Clusters card can retry after error
    Given Clusters API fails once
    And user is at the "overview" page
    Then Clusters card shows error state without count or footer link
    When user clicks Try Again in Clusters card
    Then Clusters card shows cluster count and footer link

  @core-2
  Scenario: Clusters card shows no data state with dash
    Given Clusters API returns empty data
    And user is at the "overview" page
    Then Clusters card shows no data state with dash

  # Tests using real backend data
  @core-2
  Scenario: Clusters card displays cluster count from backend
    Given user is at the "overview" page
    Then Clusters card shows cluster count and footer link

  @core-2
  Scenario: Clusters card View Mesh link navigates to mesh page
    Given user is at the "overview" page
    When user clicks View Mesh link in Clusters card
    Then user is redirected to Mesh page

  @multi-cluster
  @clusters-health-restore
  Scenario: Clusters card shows unhealthy clusters with popover
    When user scales to "0" the "istiod" in namespace "istio-system"
    And user is at the "overview" page
    Then Clusters card shows unhealthy clusters count
    When user opens the Clusters issues popover
    Then Clusters popover shows cluster with issues
    When user scales to "1" the "istiod" in namespace "istio-system"
    And the user refreshes the page
    Then Clusters card shows all healthy clusters

    @core-2
  Scenario: Service insights card shows loading state without tables or footer link
    Given Service insights APIs respond slowly
    And user is at the "overview" page
    Then Service insights card shows loading state without tables or footer link

  @core-2
  Scenario: Service insights card shows error state without tables or footer link
    Given Service insights APIs fail
    And user is at the "overview" page
    Then Service insights card shows error state without tables or footer link

  @core-2
  Scenario: Service insights card can retry after error
    Given Service insights APIs fail once
    And user is at the "overview" page
    Then Service insights card shows error state without tables or footer link
    When user clicks Try Again in Service insights card
    Then Service insights card shows data tables and footer link

  @core-2
  Scenario: Service insights footer link navigates to Services list with all namespaces and sort
    Given Service insights APIs are observed
    And user is at the "overview" page
    When user clicks View all services in Service insights card
    Then user is redirected to Services list with all namespaces and service insights sorting

  @core-2
  Scenario: Service insights service link navigates to service details
    Given Service insights APIs are observed
    And user is at the "overview" page
    When user clicks a valid service link in Service insights card
    Then user is redirected to that Service details page

  @core-2
  Scenario: Service insights card shows mock rate table
    Given Service insights mock APIs are observed
    And user is at the "overview" page
    Then Service insights card shows mock data tables