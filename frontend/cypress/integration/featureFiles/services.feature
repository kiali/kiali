@services
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Services page

  User opens the Services page and sees the bookinfo namespaces

  Background:
    Given user is at administrator perspective
    And user is at the "services" list page

  @bookinfo-app
  Scenario: See services table with correct info
    When user applies kiali api "rest" annotations
    When user selects the "bookinfo" namespace
    Then user sees a table with headings
      | Health | Name | Namespace | Labels | Configuration | Details |
    And the "productpage" row is visible
    And the health column on the "productpage" row has a health icon
    And the "Name" column on the "productpage" row has a link ending in "/namespaces/bookinfo/services/productpage"
    And the "Namespace" column on the "productpage" row has the text "bookinfo"
    And the "Labels" column on the "productpage" row has the text "app=productpage"
    And the "Labels" column on the "productpage" row has the text "service=productpage"
    And the "Configuration" column on the "productpage" row has a link ending in "/namespaces/bookinfo/services/productpage"
    And the "Details" column on the "productpage" row has a link ending in "/namespaces/bookinfo/istio/virtualservices/bookinfo"
    And the "Details" column on the "productpage" row has a link ending in "/namespaces/bookinfo/istio/gateways/bookinfo-gateway"
    And the "Details" column on the "productpage" row has a icon with title "API Documentation"
    And the "Cluster" column "disappears"

  @smoke
  Scenario: See all Services toggles
    Then user sees all the Services toggles

  @smoke
  Scenario: Toggle Services configuration toggle
    When user "unchecks" toggle "configuration"
    Then the "Configuration" column "disappears"
    When user "checks" toggle "configuration"
    Then the "Configuration" column "appears"

  @bookinfo-app
  Scenario: Filter services table by Service Name
    When user selects the "bookinfo" namespace
    And user selects filter "Service Name"
    And user filters for name "productpage"
    Then user sees "productpage" in the table
    And table length should be 1

  @bookinfo-app
  Scenario: Filter services table by Service Type
    When user selects the "bookinfo" namespace
    And user selects filter "Service Type"
    And user filters for service type "External"
    Then user sees "nothing" in the table

  @bookinfo-app
  Scenario: Filter services table by sidecar
    When user selects the "bookinfo" namespace
    And user selects filter "Istio Sidecar"
    And user filters for sidecar "Present"
    Then user sees "something" in the table

  @bookinfo-app
  Scenario: Filter services table by Istio Config Type
    When user selects the "bookinfo" namespace
    And user selects filter "Istio Config Type"
    And user filters for istio config type "VirtualService"
    Then user sees "productpage" in the table
    And table length should be 1

  @bookinfo-app
  Scenario: Filter services table by health
    When user selects the "bookinfo" namespace
    And user selects filter "Health"
    And user filters for health "Healthy"
    Then user sees "something" in the table
    And user should only see healthy services in the table

  @bookinfo-app
  Scenario: Filter services table by label
    When user selects the "bookinfo" namespace
    And user selects filter "Label"
    And user filters for label "app=productpage"
    Then user sees "productpage" in the table
    And table length should be 1

  @bookinfo-app
  Scenario: Filter services table by label click
    When user selects the "bookinfo" namespace
    And user clicks "app=productpage" label
    Then user sees "productpage" in the table
    And table length should be 1

  @bookinfo-app
  Scenario: Filter and unfilter services table by label click
    When user selects the "bookinfo" namespace
    And user clicks "app=productpage" label
    And user clicks "app=productpage" label
    Then table length should exceed 1

  @bookinfo-app
  Scenario: The healthy status of a service is reported in the list of services
    Given a service in the cluster with a healthy amount of traffic
    When user selects the "bookinfo" namespace
    Then the service should be listed as "healthy"

  @sleep-app
  Scenario: The idle status of a service is reported in the list of services
    Given a service in the cluster with no traffic
    When user selects the "sleep" namespace
    Then the service should be listed as "na"
    And the health status of the service should be "No health information"

  @error-rates-app
  Scenario: The failing status of a service is reported in the list of services
    Given a service in the mesh with a failing amount of traffic
    When user selects the "alpha" namespace
    Then the service should be listed as "failure"
    And the health status of the service should be "Failure"

  @error-rates-app
  Scenario: The degraded status of a service is reported in the list of services
    Given a service in the mesh with a degraded amount of traffic
    When user selects the "alpha" namespace
    Then the service should be listed as "degraded"
    And the health status of the service should be "Degraded"

  @multi-cluster
  Scenario: The column related to cluster name should be visible
    When user selects the "bookinfo" namespace
    Then the "Cluster" column "appears"
    And an entry for "east" cluster should be in the table
    And an entry for "west" cluster should be in the table

  # inspired by this: https://github.com/kiali/kiali/pull/5998#pullrequestreview-1383754665
  @multi-cluster
  Scenario: Services from both clusters should have a validation
    When user selects the "bookinfo" namespace
    Then configuration in both clusters for the "bookinfo" namespace should be healthy

  @multi-cluster
  Scenario: Sort list by cluster column
    When user selects the "bookinfo" namespace
    And user sorts the list by column "Cluster" in "ascending" order
    Then the list is sorted by column "Cluster" in "ascending" order
    When user sorts the list by column "Cluster" in "descending" order
    Then the list is sorted by column "Cluster" in "descending" order
