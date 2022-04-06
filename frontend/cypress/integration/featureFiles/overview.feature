Feature: Kiali Overview page

  User opens the Overview page and see the demo "error-rates" namespaces

  Background:
    Given user is at administrator perspective
    And user opens the overview page

  @overview-page
  Scenario: See "alpha" and "beta" namespaces
    Then user sees the "alpha" namespace
    And user sees the "beta" namespace

  @overview-page
  Scenario: Doesn't see a "bad" namespace
    Then user doesn't see the "bad" namespace

  @overview-page
  Scenario: Select the COMPACT view
    When user clicks in the "COMPACT" view
    Then user sees a "COMPACT" "alpha" namespace

  @overview-page
  Scenario: Select the EXPAND view
    When user clicks in the "EXPAND" view
    Then user sees a "EXPAND" "beta" namespace

  @overview-page
  Scenario: Select the LIST view
    When user clicks in the "LIST" view
    Then user sees a "LIST" "beta" namespace

  @overview-page
  Scenario: Filter by namespace
    When user filters "alpha" namespace
    Then user sees the "alpha" namespace
    And user doesn't see the "beta" namespace

  @overview-page
  Scenario: Filter by health
    When user filters "Failure" health
    Then user sees the "alpha" namespace
    And user sees the "beta" namespace
    And user doesn't see the "default" namespace

  @overview-page
  Scenario: Sort by name
    When user filters "Failure" health
    And user sorts by name desc
    Then user sees the "beta,alpha" namespace list

  @overview-page
  Scenario: Health for Apps
    When user selects Health for "Apps"
    Then user sees the "alpha" namespace with "Applications"

  @overview-page
  Scenario: Health for Workloads
    When user selects Health for "Workloads"
    Then user sees the "alpha" namespace with "Workloads"

  @overview-page
  Scenario: Health for Services
    When user selects Health for "Services"
    Then user sees the "alpha" namespace with "Services"

  @overview-page
  Scenario: Last 10 minutes
    When user selects "Last 10m" time range
    Then user sees the "alpha" namespace with Inbound traffic "10m"

