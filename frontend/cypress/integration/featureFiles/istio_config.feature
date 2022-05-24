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
    When the user filters by "Istio Name" for "bookinfo-gateway"
    Then user only sees "bookinfo-gateway"

  @istio-page
  Scenario: Filter Istio Config objects by Istio Type
    When the user filters by "Istio Type" for "Gateway"
    Then user only sees "bookinfo-gateway"

  @istio-page
  Scenario: Filter Istio Config objects by Valid configuration
    When the user filters by "Config" for "Valid"
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

  Scenario: KIA0101 validation
    Given a "foo" AuthorizationPolicy in the "bookinfo" namespace
    And the AuthorizationPolicy has a from-source rule for "bar" namespace
    When the user refreshes the list page
    And user selects the "bookinfo" namespace
    Then the AuthorizationPolicy should have a "warning"

  Scenario: KIA0102 validation
    Given a "foo" AuthorizationPolicy in the "bookinfo" namespace
    And the AuthorizationPolicy has a to-operation rule with "non-fully-qualified-grpc" method
    When the user refreshes the list page
    And user selects the "bookinfo" namespace
    Then the AuthorizationPolicy should have a "warning"

  Scenario: KIA0104 validation
    Given a "foo" AuthorizationPolicy in the "bookinfo" namespace
    And the AuthorizationPolicy has a to-operation rule with "missing.hostname" host
    When the user refreshes the list page
    And user selects the "bookinfo" namespace
    Then the AuthorizationPolicy should have a "danger"

  Scenario: KIA0106 validation
    Given a "foo" AuthorizationPolicy in the "bookinfo" namespace
    And the AuthorizationPolicy has a from-source rule for "cluster.local/ns/bookinfo/sa/sleep" principal
    When the user refreshes the list page
    And user selects the "bookinfo" namespace
    Then the AuthorizationPolicy should have a "danger"

  Scenario: KIA0201 validation
    Given a "foo" DestinationRule in the "default" namespace for "sleep" host
    And the DestinationRule has a "mysubset" subset for "version=v1" labels
    And a "bar" DestinationRule in the "default" namespace for "sleep" host
    And the DestinationRule has a "mysubset" subset for "version=v1" labels
    When the user refreshes the list page
    And user selects the "default" namespace
    Then the "foo" DestinationRule should have a "warning"
    And the "bar" DestinationRule should have a "warning"

  Scenario: KIA0202 validation
    Given a "foo" DestinationRule in the "default" namespace for "nonexistent" host
    When the user refreshes the list page
    And user selects the "default" namespace
    Then the "foo" DestinationRule should have a "danger"

  Scenario: KIA0203 validation
    Given a "foo" DestinationRule in the "default" namespace for "sleep" host
    And the DestinationRule has a "v1" subset for "version=v1" labels
    And there is a "foo-route" VirtualService in the "default" namespace with a "foo-route" http-route to host "sleep" and subset "v1"
    When user selects the "default" namespace
    Then the "foo" DestinationRule should have a "danger"
