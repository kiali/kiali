@wizard-k8sgw-api-routing
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Service Details Wizard: K8s GRPC Routing

  User navigates to the service details page and open the Kiali Wizard to generate a K8s GRPC Routing scenario.

  Background:
    Given user is at administrator perspective

  @gateway-api
  @bookinfo-app
  @core
  Scenario: Create a K8s GRPC Routing scenario
    When user opens the namespace "bookinfo" and "reviews" service details page
    And user clicks in the "K8s GRPC Routing" actions
    And user sees the "Create K8s GRPC Routing" wizard
    And user clicks in the "Request Matching" tab
    And user clicks in the "headers" request matching dropdown
    And user types "end-user" in the matching header input
    And user clicks in the "Exact" match value dropdown
    And user types "jason" in the match value input
    And user adds a match
    And user clicks in the "Route To" tab
    And user types "100" traffic weight in the "reviews" workload
    And user clicks in the "Route Filtering" tab
    And user clicks in the "requestMirror" request filtering dropdown
    And user adds a filter
    And user adds a route
    And user previews the configuration
    And user creates the configuration
    Then user sees the "Istio Config" table with 1 rows

  @gateway-api
  @bookinfo-app
  @core
  Scenario: See a GRPCRoute generated
    When user clicks in the "Istio Config" table "gRPC" badge "reviews" name row link
    Then user sees the "kind: GRPCRoute" regex in the editor
    And user sees the "bookinfo" "reviews" "service" reference

  @gateway-api
  @bookinfo-app
  @core
  Scenario: Update a K8s GRPC Routing scenario
    When user opens the namespace "bookinfo" and "reviews" service details page
    And user clicks in the "K8s GRPC Routing" actions
    And user sees the "Update K8s GRPC Routing" wizard
    And user clicks on "Show" Advanced Options
    And user clicks in the "K8s Gateways" tab
    And user clicks on Add Gateway
    And user selects Create Gateway
    And user previews the configuration
    And user updates the configuration
    Then user sees the "Istio Config" table with 2 rows

  @gateway-api
  @bookinfo-app
  @core
  Scenario: See a K8s Gateway generated with warning
    When user clicks in the "Istio Config" table "G" badge "reviews-gateway" name row link
    Then user sees the "kind: Gateway" regex in the editor

  @gateway-api
  @bookinfo-app
  @core
  Scenario: Delete the K8s Gateway Routing scenario
    When user opens the namespace "bookinfo" and "reviews" service details page
    And user clicks in the "Delete Traffic Routing" actions
    And user confirms delete the configuration
    Then user sees the "Istio Config" table with empty message

