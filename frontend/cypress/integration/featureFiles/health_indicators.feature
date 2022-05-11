Feature: Health indicators
  Kiali is capable of calculating the health of services in the mesh/cluster
  using several data sources like workload availability and errors in traffic.
  Kiali offers health status at different levels of granularity: from namespace
  level, to the individual pod.

  Background:
    Given user is at administrator perspective

  Scenario: The healthy status of a logical mesh application is reported in the list of applications
    Given a healthy application in the cluster
    When I fetch the list of applications
    And user selects the "bookinfo" namespace
    Then the application should be listed as "healthy"

  Scenario: The healthy status a logical mesh application is reported in the overview of a namespace
    Given a healthy application in the cluster
    When I fetch the overview of the cluster
    Then there should be a "healthy" application indicator in the namespace
    And the "healthy" application indicator should list the application

  Scenario: The idle status of a logical mesh application is reported in the list of applications
    Given an idle application in the cluster
    When I fetch the list of applications
    And user selects the "default" namespace
    Then the application should be listed as "idle"
    And the health status of the application should be "Not Ready"

  Scenario: The idle status a logical mesh application is reported in the overview of a namespace
    Given an idle application in the cluster
    When I fetch the overview of the cluster
    Then there should be a "idle" application indicator in the namespace
    And the "idle" application indicator should list the application

  Scenario: The failing status of a logical mesh application is reported in the list of applications
    Given a failing application in the mesh
    When I fetch the list of applications
    And user selects the "alpha" namespace
    Then the application should be listed as "failure"
    And the health status of the application should be "Failure"

  Scenario: The failing status a logical mesh application is reported in the overview of a namespace
    Given a failing application in the mesh
    When I fetch the overview of the cluster
    Then there should be a "failure" application indicator in the namespace
    And the "failure" application indicator should list the application

  Scenario: The degraded status of a logical mesh application is reported in the list of applications
    Given a degraded application in the mesh
    When I fetch the list of applications
    And user selects the "alpha" namespace
    Then the application should be listed as "degraded"
    And the health status of the application should be "Degraded"

  Scenario: The degraded status a logical mesh application is reported in the overview of a namespace
    Given a degraded application in the mesh
    When I fetch the overview of the cluster
    Then there should be a "degraded" application indicator in the namespace
    And the "degraded" application indicator should list the application
