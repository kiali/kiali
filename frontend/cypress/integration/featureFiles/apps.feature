Feature: Kiali Apps List page

  On the Apps list page, an admin should see all the applications in the bookinfo namespace.
  The admin should also be able to filter for the Apps they are looking for.

  Background:
    Given user is at administrator perspective
    And user is at the "applications" page
    And user selects the "bookinfo" namespace

  @apps-page
  Scenario: See all Apps objects in the bookinfo namespace.
    Then user sees all the Apps in the bookinfo namespace
    And user sees Health information for Apps
    And user sees Name information for Apps
    And user sees Namespace information for Apps
    And user sees Labels information for Apps
    And user sees Details information for Apps

  @apps-page
  Scenario: Filter Apps by Istio Name
    When the user filters by "App Name" for "productpage"
    Then user only sees "productpage"

  @apps-page
  Scenario: Filter Apps by Istio Sidecar
    When the user filters by "Istio Sidecar" for "Present"
    Then user sees "productpage"
    And user sees "details"
    And user sees "reviews"
    And user sees "ratings"
    And user sees "kiali-traffic-generator"

  @apps-page
  Scenario: Filter Apps by Istio Type
    When the user filters by "Istio Type" for "VirtualService"
    Then user only sees "productpage"

  @apps-page
  Scenario: Filter Apps by Health
    When the user filters by "Health" for "Healthy"
    Then user only sees healthy apps

  @apps-page
  Scenario: Filter Applications table by Label
    When the user filters by "Label" for "app=reviews"
    Then user sees "reviews"
    And user only sees 1 apps

  @apps-page
  Scenario: The healthy status of a logical mesh application is reported in the list of applications
    Given a healthy application in the cluster
    When I fetch the list of applications
    And user selects the "bookinfo" namespace
    Then the application should be listed as "healthy"

  @apps-page
  Scenario: The idle status of a logical mesh application is reported in the list of applications
    Given an idle application in the cluster
    When I fetch the list of applications
    And user selects the "default" namespace
    Then the application should be listed as "idle"
    And the health status of the application should be "Not Ready"

  @apps-page
  Scenario: The failing status of a logical mesh application is reported in the list of applications
    Given a failing application in the mesh
    When I fetch the list of applications
    And user selects the "alpha" namespace
    Then the application should be listed as "failure"
    And the health status of the application should be "Failure"

  @apps-page
  Scenario: The degraded status of a logical mesh application is reported in the list of applications
    Given a degraded application in the mesh
    When I fetch the list of applications
    And user selects the "alpha" namespace
    Then the application should be listed as "degraded"
    And the health status of the application should be "Degraded"
