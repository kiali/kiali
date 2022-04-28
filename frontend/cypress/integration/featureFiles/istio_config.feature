Feature: Kiali Istio Config page

  On the Istio Config page, an admin should see all the Istio Config objects.
  The admin should be able to filter for the Istio Config objects they are looking for
  and create new Istio objects.

  Background:
    Given user is at administrator perspective
    And user is at the "istio" page
    And user selects the "bookinfo" namespace

  @istio-page
  Scenario: See all Istio Config objects in the bookinfo namespace.
    Then user sees all the Istio Config objects in the bookinfo namespace
    And user sees Name information for Istio objects
    And user sees Namespace information for Istio objects
    And user sees Type information for Istio objects
    And user sees Configuration information for Istio objects
  
  @istio-page
  Scenario: Filter Istio Config objects by Istio Name
    Given the user filters by "Istio Name" for "bookinfo-gateway"
    Then user only sees "bookinfo-gateway"

  @istio-page
  Scenario: Filter Istio Config objects by Istio Type
    Given the user filters by "Istio Type" for "Gateway"
    Then user only sees "bookinfo-gateway"

  @istio-page
  Scenario: Filter Istio Config objects by Valid configuration
    Given the user filters by "Config" for "Valid"
    Then user sees "bookinfo-gateway"
    And user sees "bookinfo"

  @istio-page
  Scenario: Ability to create an AuthorizationPolicy object
    Then the user can create a "AuthorizationPolicy" Istio object

  @istio-page
  Scenario: Ability to create a Gateway object
    Then the user can create a "Gateway" Istio object

  @istio-page
  Scenario: Ability to create a PeerAuthentication object
    Then the user can create a "PeerAuthentication" Istio object

  @istio-page
  Scenario: Ability to create a RequestAuthentication object
    Then the user can create a "RequestAuthentication" Istio object

  @istio-page
  Scenario: Ability to create a ServiceEntry object
    Then the user can create a "ServiceEntry" Istio object

  @istio-page
  Scenario: Ability to create a Sidecar object
    Then the user can create a "Sidecar" Istio object
