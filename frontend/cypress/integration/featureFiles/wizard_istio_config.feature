@istio-page
Feature: Kiali Istio Config page

  On the Istio Config page, an admin should see all the Istio Config objects.
  The admin should be able to filter for the Istio Config objects they are looking for
  and create new Istio objects.

  Background:
    Given user is at administrator perspective
    And user is at the "istio" page
    And user selects the "bookinfo" namespace

  @wizard-istio-config
  Scenario: Create a K8s Gateway scenario
    When user clicks in the "K8sGateway" Istio config actions
    And user sees the "Create K8sGateway" config wizard
    And user adds listener
    And user types "k8sapigateway" in the "name" input
    And user types "listener" in the "addName0" input
    And user checks validation of the hostname "addHostname0" input
    And user types "website.com" in the "addHostname0" input
    And user types "8080" in the "addPort0" input
    And user previews the configuration
    And user creates the istio config
    Then the "K8sGateway" "k8sapigateway" should be listed in "bookinfo" namespace

  @wizard-istio-config
  Scenario: Try to create a Gateway with no name 
    When user clicks in the "Gateway" Istio config actions
    And user sees the "Create Gateway" config wizard
    Then the "name" input should be empty
    And the "name" input should display a warning
    And the preview button should be disabled

  @wizard-istio-config
  Scenario: Try to create a Gateway with invalid name 
    When user clicks in the "Gateway" Istio config actions
    And user sees the "Create Gateway" config wizard
    And user types "!@#$%^*()_+" in the "name" input
    Then the "name" input should display a warning
    And the preview button should be disabled

  @wizard-istio-config
  Scenario: Create a Gateway scenario
    When user clicks in the "Gateway" Istio config actions
    And user sees the "Create Gateway" config wizard
    And user types "mygateway" in the "name" input
    And user adds a server to a server list
    Then the preview button should be disabled
    And user types "website.com" in the "hosts0" input
    And user types "8080" in the "addPortNumber0" input
    And user types "foobar" in the "addPortName0" input
    And user previews the configuration
    And user creates the istio config
    Then the "Gateway" "mygateway" should be listed in "bookinfo" namespace

  @wizard-istio-config
  Scenario: Try to create a Gateway with negative port number
    When user clicks in the "Gateway" Istio config actions
    And user sees the "Create Gateway" config wizard
    And user types "mygateway2" in the "name" input
    And user adds a server to a server list
    And user types "website.com" in the "hosts0" input
    And user types "-8080" in the "addPortNumber0" input
    And user types "foobar" in the "addPortName0" input
    Then the preview button should be disabled
    And the "addPortNumber0" input should display a warning

  @wizard-istio-config
  Scenario: Try to create a Gateway with invalid port number
    When user clicks in the "Gateway" Istio config actions
    And user sees the "Create Gateway" config wizard
    And user types "mygateway2" in the "name" input
    And user adds a server to a server list
    And user types "website.com" in the "hosts0" input
    And user types "65536" in the "addPortNumber0" input
    And user types "foobar" in the "addPortName0" input
    Then the preview button should be disabled
    And the "addPortNumber0" input should display a warning

  @wizard-istio-config
  Scenario: Try to insert letters in the port field
    When user clicks in the "Gateway" Istio config actions
    And user sees the "Create Gateway" config wizard
    And user types "mygateway2" in the "name" input
    And user adds a server to a server list
    And user types "website.com" in the "hosts0" input
    And user types "lorem ipsum" in the "addPortNumber0" input
    And user types "foobar" in the "addPortName0" input
    Then the preview button should be disabled
    And the "addPortNumber0" input should display a warning

  @wizard-istio-config
  Scenario: Create a Gateway with duplicate name 
    When user clicks in the "Gateway" Istio config actions
    And user sees the "Create Gateway" config wizard
    And user types "mygateway" in the "name" input
    And user adds a server to a server list
    And user types "website.com" in the "hosts0" input
    And user types "8080" in the "addPortNumber0" input
    And user types "foobar" in the "addPortName0" input
    And user previews the configuration
    And user creates the istio config
    Then an error message "Could not create Istio Gateway objects." is displayed

  @wizard-istio-config
  Scenario: Try to create a Gateway without filling the inputs related to TLS 
    When user clicks in the "Gateway" Istio config actions
    And user sees the "Create Gateway" config wizard
    And user types "mygatewaywithtls" in the "name" input
    And user adds a server to a server list
    And user types "website.com" in the "hosts0" input
    And user types "8080" in the "addPortNumber0" input
    And user types "foobar" in the "addPortName0" input
    And user chooses "TLS" mode from the "addPortProtocol0" select
    And user chooses "SIMPLE" mode from the "addTlsMode" select
    Then the "server-certificate" input should be empty
    And the "server-certificate" input should display a warning
    And the "private-key" input should be empty
    And the "private-key" input should display a warning
    And the preview button should be disabled

  @wizard-istio-config
  Scenario: Create a Gateway with TLS 
    When user clicks in the "Gateway" Istio config actions
    And user sees the "Create Gateway" config wizard
    And user types "mygatewaywithtls" in the "name" input
    And user adds a server to a server list
    And user types "website.com" in the "hosts0" input
    And user types "8080" in the "addPortNumber0" input
    And user types "foobar" in the "addPortName0" input
    And user chooses "TLS" mode from the "addPortProtocol0" select
    And user chooses "SIMPLE" mode from the "addTlsMode" select
    And user types "foo" in the "server-certificate" input
    And user types "bar" in the "private-key" input
    And user previews the configuration
    And user creates the istio config
    Then the "Gateway" "mygatewaywithtls" should be listed in "bookinfo" namespace

  @wizard-istio-config
  Scenario: Try to create a ServiceEntry with empty fields
    When user clicks in the "ServiceEntry" Istio config actions
    And user sees the "Create ServiceEntry" config wizard
    Then the "name" input should be empty
    And the "name" input should display a warning
    And the "hosts" input should be empty
    And the "hosts" input should display a warning
    And the "ServiceEntry has no Ports defined" message should be displayed
    And the preview button should be disabled

  @wizard-istio-config
  Scenario: Try to create a ServiceEntry with invalid name and host specified
    When user clicks in the "ServiceEntry" Istio config actions
    And user sees the "Create ServiceEntry" config wizard
    And user types "%%%%$#&*&" in the "name" input
    And user types "website.com," in the "hosts" input
    And the "name" input should display a warning
    And the "hosts" input should display a warning
    And the preview button should be disabled

  @wizard-istio-config
  Scenario: Create a ServiceEntry without ports specified 
    When user clicks in the "ServiceEntry" Istio config actions
    And user sees the "Create ServiceEntry" config wizard
    And user types "myservice" in the "name" input
    And user types "website.com,website2.com" in the "hosts" input
    And the "ServiceEntry has no Ports defined" message should be displayed
    And user previews the configuration
    And user creates the istio config
    Then the "ServiceEntry" "myservice" should be listed in "bookinfo" namespace

  @wizard-istio-config
  Scenario: Try to create a ServiceEntry with empty ports specified 
    When user clicks in the "ServiceEntry" Istio config actions
    And user sees the "Create ServiceEntry" config wizard
    And user types "myservice" in the "name" input
    And user types "website.com" in the "hosts" input
    And user opens the "Add Port" submenu
    Then the "addPortNumber0" input should be empty
    And the "addPortNumber0" input should display a warning
    And the "addPortName0" input should be empty
    And the "addPortName0" input should display a warning
    And the "addTargetPort0" input should be empty
    And the "addTargetPort0" input should not display a warning
    And the preview button should be disabled

  @wizard-istio-config
  Scenario: Create a ServiceEntry with ports specified 
    When user clicks in the "ServiceEntry" Istio config actions
    And user sees the "Create ServiceEntry" config wizard
    And user types "myservice2" in the "name" input
    And user types "website.com,website2.com" in the "hosts" input
    And user opens the "Add Port" submenu
    Then the "addPortNumber0" input should be empty
    And user types "8080" in the "addPortNumber0" input
    And user types "foobar" in the "addPortName0" input
    And user types "8080" in the "addTargetPort0" input
    And user previews the configuration
    And user creates the istio config
    Then the "ServiceEntry" "myservice2" should be listed in "bookinfo" namespace

  @wizard-istio-config
  Scenario: Try to create duplicate port specifications on a ServiceEntry
    When user clicks in the "ServiceEntry" Istio config actions
    And user sees the "Create ServiceEntry" config wizard
    And user types "myservice2" in the "name" input
    And user types "website.com,website2.com" in the "hosts" input
    And user opens the "Add Port" submenu
    And user types "8080" in the "addPortNumber0" input
    And user types "foobar" in the "addPortName0" input
    And user types "8080" in the "addTargetPort0" input  
    And user opens the "Add Port" submenu
    And user types "8080" in the "addPortNumber1" input
    And user types "foobar" in the "addPortName1" input
    And user types "8080" in the "addTargetPort1" input
    Then the preview button should be disabled

@wizard-istio-config
  Scenario: Create multiple K8s Gateways with colliding hostnames and port combinations and check for a reference
    When user clicks in the "K8sGateway" Istio config actions
    And user sees the "Create K8sGateway" config wizard
    And user adds listener
    And user types "gatewayapi-1" in the "name" input
    And user types "default" in the "addName0" input
    And user types "bookinfo-istio-system.apps.ocp4-kqe1.maistra.upshift.redhat.com" in the "addHostname0" input
    And user types "80" in the "addPort0" input
    And user adds a hostname
    And user chooses "Hostname" mode from the "addType0" select
    And user types "google.com" in the "addValue0" input
    And user previews the configuration
    And user creates the istio config
    And user clicks in the "K8sGateway" Istio config actions
    And user sees the "Create K8sGateway" config wizard
    And user adds listener
    And user types "gatewayapi-2" in the "name" input
    And user types "default" in the "addName0" input
    And user types "bookinfo-istio-system.apps.ocp4-kqe1.maistra.upshift.redhat.com" in the "addHostname0" input
    And user types "80" in the "addPort0" input
    And user adds a hostname
    And user chooses "Hostname" mode from the "addType0" select
    And user types "google.com" in the "addValue0" input
    And user previews the configuration
    And user creates the istio config
    Then the "K8sGateway" "gatewayapi-1" should be listed in "bookinfo" namespace
    And the "K8sGateway" "gatewayapi-2" should be listed in "bookinfo" namespace
    When viewing the detail for "gatewayapi-1"
    Then "gatewayapi-2" should be referenced


@wizard-istio-config
  Scenario: Delete one of the K8s Gateways and check that the reference is removed
    When viewing the detail for "gatewayapi-2"
    And choosing to delete it 
    Then the "K8sGateway" "gatewayapi-2" should not be listed in "bookinfo" namespace
    When viewing the detail for "gatewayapi-1"
    Then "gatewayapi-2" should not be referenced anymore
