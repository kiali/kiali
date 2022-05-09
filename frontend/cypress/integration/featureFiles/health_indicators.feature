Feature: Health indicators
  (TODO: Description)

  Background:
    Given user is at administrator perspective

  Scenario: Application is healthy
    Given a healthy application in the cluster
    When I fetch the list of applications
    And user selects the "bookinfo" namespace
    Then the application should be listed as "healthy"

  Scenario: Application is healthy - Overview
    Given a healthy application in the cluster
    When I fetch the overview of the cluster
    Then there should be a "healthy" application indicator in the namespace
    And the "healthy" application indicator should list the application

  Scenario: Application is idle
    Given an idle application in the cluster
    When I fetch the list of applications
    And user selects the "default" namespace
    Then the application should be listed as "idle"
    And the health status of the application should be "Not Ready"

  Scenario: Application is idle - Overview
    Given an idle application in the cluster
    When I fetch the overview of the cluster
    Then there should be a "idle" application indicator in the namespace
    And the "idle" application indicator should list the application

  Scenario: Application is failing
    Given a failing application in the mesh
    When I fetch the list of applications
    And user selects the "alpha" namespace
    Then the application should be listed as "failure"
    And the health status of the application should be "Failure"

  Scenario: Application is failing - Overview
    Given a failing application in the mesh
    When I fetch the overview of the cluster
    Then there should be a "failure" application indicator in the namespace
    And the "failure" application indicator should list the application

  Scenario: Application is degraded
    Given a degraded application in the mesh
    When I fetch the list of applications
    And user selects the "alpha" namespace
    Then the application should be listed as "degraded"
    And the health status of the application should be "Degraded"

  Scenario: Application is degraded - Overview
    Given a degraded application in the mesh
    When I fetch the overview of the cluster
    Then there should be a "degraded" application indicator in the namespace
    And the "degraded" application indicator should list the application