@apps
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Apps List page

  On the Apps list page, an admin should see all the applications in the bookinfo namespace.
  The admin should also be able to filter for the Apps they are looking for.

  Background:
    Given user is at administrator perspective
    And user is at the "applications" list page
    And user selects the "bookinfo" namespace

  @bookinfo-app
  Scenario: See all Apps objects in the bookinfo namespace.
    Then user sees all the Apps in the bookinfo namespace
    And user sees Health information for Apps
    And user sees Name information for Apps
    And user sees Namespace information for Apps
    And user sees Labels information for Apps
    And user sees Details information for Apps

  @bookinfo-app
  Scenario: See all Apps toggles
    Then user sees all the Apps toggles

  @bookinfo-app
  Scenario: Toggle Apps health toggle
    When user "unchecks" toggle "health"
    Then the "Health" column "disappears"
    When user "checks" toggle "health"
    Then the "Health" column "appears"

  @bookinfo-app
  Scenario: Filter Apps by Istio Name
    When the user filters by "App Name" for "productpage"
    Then user only sees "productpage"

  @bookinfo-app
  Scenario: Filter Apps by Istio Sidecar
    When the user filters by "Istio Sidecar" for "Present"
    Then user sees "productpage"
    And user sees "details"
    And user sees "reviews"
    And user sees "ratings"
    And user sees "kiali-traffic-generator"

  @bookinfo-app
  Scenario: Filter workloads table by Istio Sidecar not being present
    When the user filters by "Istio Sidecar" for "Not Present"
    Then user may only see "kiali-traffic-generator"

  @bookinfo-app
  Scenario: Filter Apps by Istio Config Type
    When the user filters by "Istio Config Type" for "VirtualService"
    Then user only sees "productpage"

  @bookinfo-app
  Scenario: Filter Apps by Health
    When the user filters by "Health" for "Healthy"
    Then user only sees healthy apps

  @bookinfo-app
  Scenario: Filter Applications table by Label
    When the user filters by "Label" for "app=reviews"
    Then user sees "reviews"
    And user only sees the apps with the "reviews" name in the "bookinfo" namespace

  @bookinfo-app
  Scenario: The healthy status of a logical mesh application is reported in the list of applications
    Given a healthy application in the cluster
    When I fetch the list of applications
    And user selects the "bookinfo" namespace
    Then the application should be listed as "healthy"

  @bookinfo-app
  @sleep-app
  @sleep-app-scaleup-after
  Scenario: The idle status of a logical mesh application is reported in the list of applications
    Given an idle sleep application in the cluster
    When I fetch the list of applications
    And user selects the "sleep" namespace
    Then the application should be listed as "idle"
    And the health status of the application should be "Not Ready"

  @bookinfo-app
  @error-rates-app
  Scenario: The failing status of a logical mesh application is reported in the list of applications
    Given a failing application in the mesh
    When I fetch the list of applications
    And user selects the "alpha" namespace
    Then the application should be listed as "failure"
    And the health status of the application should be "Failure"

  @bookinfo-app
  @error-rates-app
  @skip-lpinterop
  Scenario: The degraded status of a logical mesh application is reported in the list of applications
    Given a degraded application in the mesh
    When I fetch the list of applications
    And user selects the "alpha" namespace
    Then the application should be listed as "degraded"
    And the health status of the application should be "Degraded"

  @multi-cluster
  @skip
  Scenario: The column related to cluster name should be visible
    Then the "Cluster" column "appears"
