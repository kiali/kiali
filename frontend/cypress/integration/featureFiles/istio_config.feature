Feature: Kiali Istio Config page

  User opens the Istio Config page and sees the Istio Config objects for Bookinfo

  Background:
    Given user is at administrator perspective
    And user opens the "istio" page
    And user selects the "bookinfo" namespace in the NamespaceSelector
    And Kiali is done loading

  @istio-page
  Scenario: See a table with correct info
    Then user sees a table with headings
      | Name | Namespace | Type | Configuration | 
    And the "bookinfo-gateway" row is visible
    And the "Name" column on the "bookinfo-gateway" row has a link ending in "/namespaces/bookinfo/istio/gateways/bookinfo-gateway"
    And the "Namespace" column on the "bookinfo-gateway" row has the text "bookinfo"
    And the "Type" column on the "bookinfo-gateway" row has the text "Gateway"
    And the "Configuration" column on the "bookinfo-gateway" row has a link ending in "/namespaces/bookinfo/istio/gateways/bookinfo-gateway?list=yaml"

  @istio-page
  Scenario: Filter istio config table by Istio Name
    When user selects filter "Istio Name"
    And user filters for name "bookinfo-gateway"
    Then user sees "bookinfo-gateway" in the table
    And table length should be 1
  
  @istio-page
  Scenario: Filter istio config table by Istio Type
    When user selects filter "Istio Type"
    And user filters for istio type "Gateway"
    Then user sees "Gateway" in the table
    And table length should be 1
  
  @istio-page
  Scenario: Filter istio config table by Config
    When user selects filter "Config"
    And user filters for config "Valid"
    Then user sees "bookinfo-gateway" in the table
    And table length should be 2

  @istio-page
  Scenario: Navigate to the create AuthorizationPolicy page through the actions dropdown
    When the user clicks the actions button
    And the user clicks the create "AuthorizationPolicy" action
    Then the user navigates to the "/istio/new/AuthorizationPolicy?namespaces=bookinfo" page

  @istio-page
  Scenario: Navigate to the create Gateway page through the actions dropdown
    When the user clicks the actions button
    And the user clicks the create "Gateway" action
    Then the user navigates to the "/istio/new/Gateway?namespaces=bookinfo" page

  @istio-page
  Scenario: Navigate to the create PeerAuthentication page through the actions dropdown
    When the user clicks the actions button
    And the user clicks the create "PeerAuthentication" action
    Then the user navigates to the "/istio/new/PeerAuthentication?namespaces=bookinfo" page

  @istio-page
  Scenario: Navigate to the create RequestAuthentication page through the actions dropdown
    When the user clicks the actions button
    And the user clicks the create "RequestAuthentication" action
    Then the user navigates to the "/istio/new/RequestAuthentication?namespaces=bookinfo" page

  @istio-page
  Scenario: Navigate to the create ServiceEntry page through the actions dropdown
    When the user clicks the actions button
    And the user clicks the create "ServiceEntry" action
    Then the user navigates to the "/istio/new/ServiceEntry?namespaces=bookinfo" page

  @istio-page
  Scenario: Navigate to the create Sidecar page through the actions dropdown
    When the user clicks the actions button
    And the user clicks the create "Sidecar" action
    Then the user navigates to the "/istio/new/Sidecar?namespaces=bookinfo" page
