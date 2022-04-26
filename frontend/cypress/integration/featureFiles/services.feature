Feature: Kiali Services page

  User opens the Services page and sees the bookinfo namespaces

  Background:
    Given user is at administrator perspective
    And user opens the "services" page
    And user selects the "bookinfo" namespace in the NamespaceSelector
    And Kiali is done loading

  @services-page
  Scenario: See a table with correct info
    Then user sees a table with headings
      | Health | Name | Namespace | Labels | Configuration | Details |
    And the "productpage" row is visible
    And the health column on the "productpage" row has a health icon
    And the "Name" column on the "productpage" row has a link ending in "/namespaces/bookinfo/services/productpage"
    And the "Namespace" column on the "productpage" row has the text "bookinfo"
    And the "Labels" column on the "productpage" row has the text "app: productpage"
    And the "Labels" column on the "productpage" row has the text "service: productpage"
    And the "Configuration" column on the "productpage" row has a link ending in "/namespaces/bookinfo/services/productpage"
    And the "Details" column on the "productpage" row has a link ending in "/namespaces/bookinfo/istio/virtualservices/bookinfo"
    And the "Details" column on the "productpage" row has a link ending in "/namespaces/bookinfo/istio/gateways/bookinfo-gateway"

  @services-page
  Scenario: Filter services table by Service Name 
    When user selects filter "Service Name"
    And user filters for name "productpage"
    Then user sees "productpage" in the table
    And table length should be 1
  
  @services-page
  Scenario: Filter services table by Service Type
    When user selects filter "Service Type"
    And user filters for service type "External"
    Then user sees "nothing" in the table
  
  @services-page
  Scenario: Filter services table by sidecar
    When user selects filter "Istio Sidecar"
    And user filters for sidecar "Present"
    Then user sees "something" in the table

  @services-page
  Scenario: Filter services table by Istio Type
    When user selects filter "Istio Type"
    And user filters for istio type "VirtualService"
    Then user sees "productpage" in the table
    And table length should be 1
  
  @services-page
  Scenario: Filter services table by health
    When user selects filter "Health"
    And user filters for health "Healthy"
    Then user sees "something" in the table
    And user should only see healthy services in the table

  @services-page
  Scenario: Filter services table by label
    When user selects filter "Label"
    And user filters for label "app:productpage"
    Then user sees "productpage" in the table
    And table length should be 1
