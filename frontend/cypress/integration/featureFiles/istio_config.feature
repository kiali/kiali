@istio-page
Feature: Kiali Istio Config page

  On the Istio Config page, an admin should see all the Istio Config objects.
  The admin should be able to filter for the Istio Config objects they are looking for
  and create new Istio objects.

  Background:
    Given user is at administrator perspective
    And user is at the "istio" page
    And user selects the "bookinfo" namespace

  Scenario: See all Istio Config objects in the bookinfo namespace.
    Then user sees all the Istio Config objects in the bookinfo namespace
    And user sees Name information for Istio objects
    And user sees Namespace information for Istio objects
    And user sees Type information for Istio objects
    And user sees Configuration information for Istio objects

  Scenario: Filter Istio Config objects by Istio Name
    When the user filters by "Istio Name" for "bookinfo-gateway"
    Then user only sees "bookinfo-gateway"

  Scenario: Filter Istio Config objects by Istio Type
    When the user filters by "Istio Type" for "Gateway"
    Then user only sees "bookinfo-gateway"

  Scenario: Filter Istio Config objects by Valid configuration
    When the user filters by "Config" for "Valid"
    Then user sees "bookinfo-gateway"
    And user sees "bookinfo"

  Scenario: Ability to create an AuthorizationPolicy object
    Then the user can create a "AuthorizationPolicy" Istio object

  Scenario: Ability to create a Gateway object
    Then the user can create a "Gateway" Istio object

  Scenario: Ability to create a PeerAuthentication object
    Then the user can create a "PeerAuthentication" Istio object

  Scenario: Ability to create a RequestAuthentication object
    Then the user can create a "RequestAuthentication" Istio object

  Scenario: Ability to create a ServiceEntry object
    Then the user can create a "ServiceEntry" Istio object

  Scenario: Ability to create a Sidecar object
    Then the user can create a "Sidecar" Istio object

  @crd-validation
  Scenario: KIA0101 validation
    Given a "foo" AuthorizationPolicy in the "bookinfo" namespace
    And the AuthorizationPolicy has a from-source rule for "bar" namespace
    When the user refreshes the list page
    And user selects the "bookinfo" namespace
    Then the AuthorizationPolicy should have a "warning"

  @crd-validation
  Scenario: KIA0102 validation
    Given a "foo" AuthorizationPolicy in the "bookinfo" namespace
    And the AuthorizationPolicy has a to-operation rule with "non-fully-qualified-grpc" method
    When the user refreshes the list page
    And user selects the "bookinfo" namespace
    Then the AuthorizationPolicy should have a "warning"

  @crd-validation
  Scenario: KIA0104 validation
    Given a "foo" AuthorizationPolicy in the "bookinfo" namespace
    And the AuthorizationPolicy has a to-operation rule with "missing.hostname" host
    When the user refreshes the list page
    And user selects the "bookinfo" namespace
    Then the AuthorizationPolicy should have a "danger"

  @crd-validation
  Scenario: KIA0106 validation
    Given a "foo" AuthorizationPolicy in the "bookinfo" namespace
    And the AuthorizationPolicy has a from-source rule for "cluster.local/ns/bookinfo/sa/sleep" principal
    When the user refreshes the list page
    And user selects the "bookinfo" namespace
    Then the AuthorizationPolicy should have a "danger"

  @crd-validation
  Scenario: KIA0201 validation
    Given a "foo" DestinationRule in the "default" namespace for "sleep" host
    And the DestinationRule has a "mysubset" subset for "version=v1" labels
    And a "bar" DestinationRule in the "default" namespace for "sleep" host
    And the DestinationRule has a "mysubset" subset for "version=v1" labels
    When the user refreshes the list page
    And user selects the "default" namespace
    Then the "foo" "DestinationRule" of the "default" namespace should have a "warning"
    And the "bar" "DestinationRule" of the "default" namespace should have a "warning"

  @crd-validation
  Scenario: KIA0202 validation
    Given a "foo" DestinationRule in the "default" namespace for "nonexistent" host
    When the user refreshes the list page
    And user selects the "default" namespace
    Then the "foo" "DestinationRule" of the "default" namespace should have a "danger"

  @crd-validation
  Scenario: KIA0203 validation
    Given a "foo" DestinationRule in the "default" namespace for "sleep" host
    And the DestinationRule has a "v1" subset for "version=v1" labels
    And there is a "foo-route" VirtualService in the "default" namespace with a "foo-route" http-route to host "sleep" and subset "v1"
    When user selects the "default" namespace
    Then the "foo" "DestinationRule" of the "default" namespace should have a "danger"

  @crd-validation
  Scenario: KIA0207 validation
    Given a "disable-mtls" DestinationRule in the "default" namespace for "*.default.svc.cluster.local" host
    And the DestinationRule disables mTLS
    And there is a "default" PeerAuthentication in the "default" namespace
    And the PeerAuthentication has "STRICT" mtls mode
    When user selects the "default" namespace
    Then the "disable-mtls" "DestinationRule" of the "default" namespace should have a "danger"

  @crd-validation
  Scenario: KIA0208 validation
    Given a "disable-mtls" DestinationRule in the "default" namespace for "*.default.svc.cluster.local" host
    And the DestinationRule disables mTLS
    And there is a "default" PeerAuthentication in the "istio-system" namespace
    And the PeerAuthentication has "STRICT" mtls mode
    When user selects the "default" namespace
    Then the "disable-mtls" "DestinationRule" of the "default" namespace should have a "danger"

  @crd-validation
  Scenario: KIA0209 validation
    Given a "foo" DestinationRule in the "default" namespace for "*.default.svc.cluster.local" host
    And the DestinationRule has a "v1" subset for "" labels
    When user selects the "default" namespace
    Then the "foo" "DestinationRule" of the "default" namespace should have a "warning"

  @crd-validation
  Scenario: KIA0301 validation
    Given there is a "foo" Gateway on "bookinfo" namespace for "productpage.local" hosts on HTTP port 80 with "app=productpage" labels selector
    And there is a "foo" Gateway on "default" namespace for "productpage.local" hosts on HTTP port 80 with "app=productpage" labels selector
    When user selects the "default" namespace
    Then the "foo" "Gateway" of the "bookinfo" namespace should have a "warning"
    And the "foo" "Gateway" of the "default" namespace should have a "warning"

  @crd-validation
  Scenario: KIA0302 validation
    Given there is a "foo" Gateway on "default" namespace for "foo.local" hosts on HTTP port 80 with "app=foo" labels selector
    When user selects the "default" namespace
    Then the "foo" "Gateway" of the "default" namespace should have a "warning"

  @crd-validation
  Scenario: KIA0505 validation
    Given a "enable-mtls" DestinationRule in the "default" namespace for "*.default.svc.cluster.local" host
    And the DestinationRule enables mTLS
    And there is a "default" PeerAuthentication in the "default" namespace
    And the PeerAuthentication has "DISABLE" mtls mode
    When user selects the "default" namespace
    Then the "default" "PeerAuthentication" of the "default" namespace should have a "danger"

  @crd-validation
  Scenario: KIA0506 validation
    Given a "enable-mtls" DestinationRule in the "default" namespace for "*.local" host
    And the DestinationRule enables mTLS
    And there is a "default" PeerAuthentication in the "istio-system" namespace
    And the PeerAuthentication has "DISABLE" mtls mode
    When user selects the "istio-system" namespace
    Then the "default" "PeerAuthentication" of the "istio-system" namespace should have a "danger"

  @crd-validation
  Scenario: KIA1004 validation
    Given there is a "foo" Sidecar resource in the "default" namespace that captures egress traffic for hosts "default/foo.default.svc.cluster.local"
    And the Sidecar is applied to workloads with "app=sleep" labels
    When user selects the "default" namespace
    Then the "foo" "Sidecar" of the "default" namespace should have a "warning"

  @crd-validation
  Scenario: KIA1006 validation
    Given there is a "default" Sidecar resource in the "istio-system" namespace that captures egress traffic for hosts "default/sleep.default.svc.cluster.local"
    And the Sidecar is applied to workloads with "app=grafana" labels
    When user selects the "istio-system" namespace
    Then the "default" "Sidecar" of the "istio-system" namespace should have a "warning"

  @crd-validation
  Scenario: KIA1101 validation
    Given there is a "foo" VirtualService in the "default" namespace with a "foo-route" http-route to host "foo"
    When user selects the "default" namespace
    Then the "foo" "VirtualService" of the "default" namespace should have a "danger"

  @crd-validation
  Scenario: KIA1102 validation
    Given there is a "foo" VirtualService in the "default" namespace with a "foo-route" http-route to host "sleep"
    And the VirtualService applies to "sleep" hosts
    And the VirtualService references "foo" gateways
    When user selects the "default" namespace
    Then the "foo" "VirtualService" of the "default" namespace should have a "danger"

  @crd-validation
  Scenario: KIA1104 validation
    Given there is a "foo" VirtualService in the "default" namespace with a "foo-route" http-route to host "sleep"
    And the route of the VirtualService has weight 10
    When user selects the "default" namespace
    Then the "foo" "VirtualService" of the "default" namespace should have a "warning"

  @crd-validation
  Scenario: KIA1105 validation
    Given there is a "foo" VirtualService in the "default" namespace with a "foo-route" http-route to host "sleep" and subset "v1"
    And the route of the VirtualService has weight 50
    And the http-route of the VirtualService also has a destination to host "sleep" and subset "v1" with weight 50
    And a "foo" DestinationRule in the "default" namespace for "sleep" host
    And the DestinationRule has a "v1" subset for "version=v1" labels
    When user selects the "default" namespace
    Then the "foo" "VirtualService" of the "default" namespace should have a "warning"

  @crd-validation
  Scenario: KIA1106 validation
    Given there is a "foo" VirtualService in the "default" namespace with a "foo-route" http-route to host "sleep"
    And the VirtualService applies to "sleep" hosts
    Given there is a "bar" VirtualService in the "default" namespace with a "bar-route" http-route to host "sleep"
    And the VirtualService applies to "sleep" hosts
    When user selects the "default" namespace
    Then the "foo" "VirtualService" of the "default" namespace should have a "warning"
    And the "bar" "VirtualService" of the "default" namespace should have a "warning"

  @crd-validation
  Scenario: KIA1107 validation
    Given there is a "foo" VirtualService in the "default" namespace with a "foo-route" http-route to host "sleep" and subset "v1"
    When user selects the "default" namespace
    Then the "foo" "VirtualService" of the "default" namespace should have a "warning"

# TODO: KIA06xx and KIA07xx does not appear in Istio Config list page. They appear in Svc/workload lists.
#   Thus, these validations do not belong to this feature file.

# TODO: KIA0801 is only applicable for Maistra. We don't have an environment to run tests for this one.

# TODO: Apparently, Kiali does not trigger:
#   KIA0204, KIA0205, KIA0206, KIA0401, KIA0501
#   It is possible that under the current mTLS defaults these
#   validations may became obsolete and may never happen anymore.
#   Below, there are some Scenarios that were prepared to teset some of these chekers,
#   but they are "red", because of the non-triggering validation.
#   Also, KIA1108 is not triggering for some unknown reason.
#
#  @crd-validation
#  Scenario: KIA0204 validation
#    Given a "default" DestinationRule in the "istio-system" namespace for "*.local" host
#    And the DestinationRule enables mTLS
#    And a "sleep" DestinationRule in the "default" namespace for "sleep" host
#    And the DestinationRule has a "mysubset" subset for "app=sleep" labels
#    When user selects the "default" namespace
#    Then the "default" DestinationRule should have a "warning"
#    And the "sleep" DestinationRule should have a "warning"
#
#  @crd-validation
#  Scenario: KIA0401 validation
#    Given there is a "default" PeerAuthentication in the "istio-system" namespace
#    And the PeerAuthentication has "STRICT" mtls mode
#    When user selects the "istio-system" namespace
#    Then the "default" "PeerAuthentication" of the "istio-system" namespace should have a "danger"
#
#  @crd-validation
#  Scenario: KIA0501 validation
#    Given there is a "default" PeerAuthentication in the "default" namespace
#    And the PeerAuthentication has "STRICT" mtls mode
#    When user selects the "default" namespace
#    Then the "default" "PeerAuthentication" of the "default" namespace should have a "danger"
#
#  @crd-validation
#  Scenario: KIA1108 validation
#    Given there is a "foo" VirtualService in the "bookinfo" namespace with a "foo-route" http-route to host "reviews"
#    And the VirtualService applies to "reviews" hosts
#    And the VirtualService references "bookinfo-gateway.bookinfo.svc.cluster.local" gateways
#    When the user refreshes the list page
#    Then the "foo" "VirtualService" of the "bookinfo" namespace should have a "warning"
