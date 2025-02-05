@wizard-istio-config
# don't change first line of this file - the tag is used for the test scripts to identify the test suite

Feature: Kiali Istio Config wizard

  On the Istio Config page, an admin should see all the Istio Config objects.
  The admin should be able to filter for the Istio Config objects they are looking for
  and create new Istio objects.

  Background:
    Given user is at administrator perspective
    And user is at the "istio" page
    And user selects the "bookinfo" namespace

  @bookinfo-app
  Scenario: Dropdown for cluster selection should not be visible in single cluster setup
    When user clicks in the "Gateway" Istio config actions
    Then user sees the "Create Gateway" config wizard
    And user does not see a dropdown for cluster selection

  @bookinfo-app
  Scenario: Create an Sidecar with labels and annotations
    When user deletes sidecar named "mysidecarwithlabels" and the resource is no longer available
    And user clicks in the "Sidecar" Istio config actions
    And user sees the "Create Sidecar" config wizard
    And user types "mysidecarwithlabels" in the "name" input
    And user clicks on Edit Labels
    And user adds key "app" and value "details" for and saves
    And user clicks on Edit Annotations
    And user adds key "key1" and value "value1" for and saves
    And user previews the configuration
    Then "app: details" should be in preview
    Then "key1: value1" should be in preview
    And user creates the istio config
    Then the "Sidecar" "mysidecarwithlabels" should be listed in "bookinfo" namespace
    And user deletes sidecar named "mysidecarwithlabels" and the resource is no longer available

  @gateway-api
  @bookinfo-app
  Scenario: Create a K8s Gateway scenario
    When user deletes k8sgateway named "k8sapigateway" and the resource is no longer available
    And user clicks in the "K8sGateway" Istio config actions
    And user sees the "Create K8sGateway" config wizard
    And user adds listener
    And user types "k8sapigateway" in the "name" input
    And user types "listener" in the "addName_0" input
    And user checks validation of the hostname "addHostname_0" input
    And user types "website.com" in the "addHostname_0" input
    And user types "8080" in the "addPort_0" input
    And user previews the configuration
    And user creates the istio config
    Then the "K8sGateway" "k8sapigateway" should be listed in "bookinfo" namespace

  @gateway-api
  @bookinfo-app
  Scenario: Create a K8s Gateway HTTPS scenario
    When user deletes k8sgateway named "k8sapigateway" and the resource is no longer available
    And user clicks in the "K8sGateway" Istio config actions
    And user sees the "Create K8sGateway" config wizard
    And user adds listener
    And user types "k8sapigateway" in the "name" input
    And user types "listener" in the "addName_0" input
    And user checks validation of the hostname "addHostname_0" input
    And user types "website.com" in the "addHostname_0" input
    And user types "443" in the "addPort_0" input
    And user chooses "HTTPS" mode from the "addPortProtocol_0" select
    And the preview button should be disabled
    And user types "cert" in the "tlsCert_0" input
    And user previews the configuration
    And user creates the istio config
    Then the "K8sGateway" "k8sapigateway" should be listed in "bookinfo" namespace

  @gateway-api
  @bookinfo-app
  Scenario: Create a K8s Reference Grant scenario
    When user deletes k8sreferencegrant named "k8srefgrant" and the resource is no longer available
    And user clicks in the "K8sReferenceGrant" Istio config actions
    And user sees the "Create K8sReferenceGrant" config wizard
    And user types "k8srefgrant" in the "name" input
    And user chooses "Gateway" mode from the "ReferenceGrantFromKind" select
    And user chooses "Secret" mode from the "ReferenceGrantToKind" select
    And user chooses "istio-system" mode from the "ReferenceGrantFromNamespace" select
    And user previews the configuration
    And user creates the istio config
    Then the "K8sReferenceGrant" "k8srefgrant" should be listed in "bookinfo" namespace

  @bookinfo-app
  Scenario: Try to create a Gateway with no name
    When user clicks in the "Gateway" Istio config actions
    And user sees the "Create Gateway" config wizard
    Then the "name" input should be empty
    And the "name" input should display a warning
    And the preview button should be disabled

  @bookinfo-app
  Scenario: Try to create a Gateway with invalid name
    When user clicks in the "Gateway" Istio config actions
    And user sees the "Create Gateway" config wizard
    And user types "!@#$%^*()_+" in the "name" input
    Then the "name" input should display a warning
    And the preview button should be disabled

  @bookinfo-app
  Scenario: Create a Gateway scenario and check that Gateway with the same name cannot be created
    When user deletes gateway named "mygateway" and the resource is no longer available
    And user clicks in the "Gateway" Istio config actions
    And user sees the "Create Gateway" config wizard
    And user types "mygateway" in the "name" input
    And user adds a server to a server list
    Then the preview button should be disabled
    And user types "website.com" in the "hosts_0" input
    And user types "8080" in the "addPortNumber_0" input
    And user types "foobar" in the "addPortName_0" input
    And user previews the configuration
    And user creates the istio config
    Then the "Gateway" "mygateway" should be listed in "bookinfo" namespace
    And user closes the success notification
    And user clicks in the "Gateway" Istio config actions
    And user sees the "Create Gateway" config wizard
    And user types "mygateway" in the "name" input
    And user adds a server to a server list
    And user types "website.com" in the "hosts_0" input
    And user types "8080" in the "addPortNumber_0" input
    And user types "foobar" in the "addPortName_0" input
    And user previews the configuration
    And user creates the istio config
    Then an error message "Could not create Istio networking.istio.io/v1, Kind=Gateway objects" is displayed

  @bookinfo-app
  Scenario: Try to create a Gateway with negative port number
    When user clicks in the "Gateway" Istio config actions
    And user sees the "Create Gateway" config wizard
    And user types "mygateway2" in the "name" input
    And user adds a server to a server list
    And user types "website.com" in the "hosts_0" input
    And user types "-8080" in the "addPortNumber_0" input
    And user types "foobar" in the "addPortName_0" input
    Then the preview button should be disabled
    And the "addPortNumber_0" input should display a warning

  @bookinfo-app
  Scenario: Try to create a Gateway with invalid port number
    When user clicks in the "Gateway" Istio config actions
    And user sees the "Create Gateway" config wizard
    And user types "mygateway2" in the "name" input
    And user adds a server to a server list
    And user types "website.com" in the "hosts_0" input
    And user types "65536" in the "addPortNumber_0" input
    And user types "foobar" in the "addPortName_0" input
    Then the preview button should be disabled
    And the "addPortNumber_0" input should display a warning

  @bookinfo-app
  Scenario: Try to insert letters in the port field
    When user clicks in the "Gateway" Istio config actions
    And user sees the "Create Gateway" config wizard
    And user types "mygateway2" in the "name" input
    And user adds a server to a server list
    And user types "website.com" in the "hosts_0" input
    And user types "lorem ipsum" in the "addPortNumber_0" input
    And user types "foobar" in the "addPortName_0" input
    Then the preview button should be disabled
    And the "addPortNumber_0" input should display a warning


  @bookinfo-app
  Scenario: Try to create a Gateway without filling the inputs related to TLS
    When user clicks in the "Gateway" Istio config actions
    And user sees the "Create Gateway" config wizard
    And user types "mygatewaywithtls" in the "name" input
    And user adds a server to a server list
    And user types "website.com" in the "hosts_0" input
    And user types "8080" in the "addPortNumber_0" input
    And user types "foobar" in the "addPortName_0" input
    And user chooses "TLS" mode from the "addPortProtocol_0" select
    And user chooses "SIMPLE" mode from the "addTlsMode" select
    Then the "server-certificate" input should be empty
    And the "server-certificate" input should display a warning
    And the "private-key" input should be empty
    And the "private-key" input should display a warning
    And the preview button should be disabled

  @bookinfo-app
  Scenario: Create a Gateway with TLS
    When user deletes gateway named "mygatewaywithtls" and the resource is no longer available
    And user clicks in the "Gateway" Istio config actions
    And user sees the "Create Gateway" config wizard
    And user types "mygatewaywithtls" in the "name" input
    And user adds a server to a server list
    And user types "website.com" in the "hosts_0" input
    And user types "8080" in the "addPortNumber_0" input
    And user types "foobar" in the "addPortName_0" input
    And user chooses "TLS" mode from the "addPortProtocol_0" select
    And user chooses "SIMPLE" mode from the "addTlsMode" select
    And user types "foo" in the "server-certificate" input
    And user types "bar" in the "private-key" input
    And user previews the configuration
    And user creates the istio config
    Then the "Gateway" "mygatewaywithtls" should be listed in "bookinfo" namespace

  @bookinfo-app
  Scenario: Try to create a ServiceEntry with empty fields
    When user clicks in the "ServiceEntry" Istio config actions
    And user sees the "Create ServiceEntry" config wizard
    Then the "name" input should be empty
    And the "name" input should display a warning
    And the "hosts" input should be empty
    And the "hosts" input should display a warning
    And the "ServiceEntry has no Ports defined" message should be displayed
    And the preview button should be disabled

  @bookinfo-app
  Scenario: Try to create a ServiceEntry with invalid name and host specified
    When user clicks in the "ServiceEntry" Istio config actions
    And user sees the "Create ServiceEntry" config wizard
    And user types "%%%%$#&*&" in the "name" input
    And user types "website.com," in the "hosts" input
    And the "name" input should display a warning
    And the "hosts" input should display a warning
    And the preview button should be disabled

  @bookinfo-app
  Scenario: Try to create a ServiceEntry without ports specified
    When user deletes service named "myservice" and the resource is no longer available
    And user clicks in the "ServiceEntry" Istio config actions
    And user sees the "Create ServiceEntry" config wizard
    And user types "myservice" in the "name" input
    And user types "website.com,website2.com" in the "hosts" input
    And the "ServiceEntry has no Ports defined" message should be displayed
    And the preview button should be disabled

  @bookinfo-app
  Scenario: Try to create a ServiceEntry with empty ports specified
    When user clicks in the "ServiceEntry" Istio config actions
    And user sees the "Create ServiceEntry" config wizard
    And user types "myservice" in the "name" input
    And user types "website.com" in the "hosts" input
    And user opens the "Add Port" submenu
    Then the "addPortNumber_0" input should be empty
    And the "addPortNumber_0" input should display a warning
    And the "addPortName_0" input should be empty
    And the "addPortName_0" input should display a warning
    And the "addTargetPort_0" input should be empty
    And the "addTargetPort_0" input should not display a warning
    And the preview button should be disabled

  @bookinfo-app
  Scenario: Create a ServiceEntry with ports specified
    When user deletes service named "myservice2" and the resource is no longer available
    And user clicks in the "ServiceEntry" Istio config actions
    And user sees the "Create ServiceEntry" config wizard
    And user types "myservice2" in the "name" input
    And user types "website.com,website2.com" in the "hosts" input
    And user opens the "Add Port" submenu
    Then the "addPortNumber_0" input should be empty
    And user types "8080" in the "addPortNumber_0" input
    And user types "foobar" in the "addPortName_0" input
    And user types "8080" in the "addTargetPort_0" input
    And user previews the configuration
    And user creates the istio config
    Then the "ServiceEntry" "myservice2" should be listed in "bookinfo" namespace

  @bookinfo-app
  Scenario: Try to create duplicate port specifications on a ServiceEntry
    When user clicks in the "ServiceEntry" Istio config actions
    And user sees the "Create ServiceEntry" config wizard
    And user types "myservice2" in the "name" input
    And user types "website.com,website2.com" in the "hosts" input
    And user opens the "Add Port" submenu
    And user types "8080" in the "addPortNumber_0" input
    And user types "foobar" in the "addPortName_0" input
    And user types "8080" in the "addTargetPort_0" input
    And user opens the "Add Port" submenu
    And user types "8080" in the "addPortNumber_1" input
    And user types "foobar" in the "addPortName_1" input
    And user types "8080" in the "addTargetPort_1" input
    Then the preview button should be disabled

  @bookinfo-app
  Scenario: Create a ServiceEntry and view the service detail page of the external service associated
    When user deletes service named "myservice3" and the resource is no longer available
    And user clicks in the "ServiceEntry" Istio config actions
    And user sees the "Create ServiceEntry" config wizard
    And user types "myservice3" in the "name" input
    And user types "host.com" in the "hosts" input
    And user opens the "Add Port" submenu
    Then the "addPortNumber_0" input should be empty
    And user types "8080" in the "addPortNumber_0" input
    And user types "foobar" in the "addPortName_0" input
    And user types "8080" in the "addTargetPort_0" input
    And user previews the configuration
    And user creates the istio config
    Then the "ServiceEntry" "myservice3" should be listed in "bookinfo" namespace
    When user is at the "services" page
    And the "host.com" row is visible
    And the "Name" column on the "host.com" row has a link ending in "/namespaces/bookinfo/services/host.com"
    And the "Details" column on the "host.com" row has a link ending in "/namespaces/bookinfo/istio/networking.istio.io/v1/ServiceEntry/myservice3"
    When user is at the details page for the "service" "bookinfo/host.com" located in the "" cluster
    Then "host.com" details information for service entry "myservice3" can be seen

  @gateway-api
  @bookinfo-app
  Scenario: Create multiple K8s Gateways with colliding hostnames and port combinations and check for a reference. Then delete one of them and the reference should be gone.
    When user deletes k8sgateway named "gatewayapi-1" and the resource is no longer available
    And user deletes k8sgateway named "gatewayapi-2" and the resource is no longer available
    And user clicks in the "K8sGateway" Istio config actions
    And user sees the "Create K8sGateway" config wizard
    And user adds listener
    And user types "gatewayapi-1" in the "name" input
    And user types "default" in the "addName_0" input
    And user types "bookinfo-istio-system.apps.ocp4-kqe1.maistra.upshift.redhat.com" in the "addHostname_0" input
    And user types "80" in the "addPort_0" input
    And user adds a hostname
    And user chooses "Hostname" mode from the "addType_0" select
    And user types "google.com" in the "addValue_0" input
    And user previews the configuration
    And user creates the istio config
    And user clicks in the "K8sGateway" Istio config actions
    And user sees the "Create K8sGateway" config wizard
    And user adds listener
    And user types "gatewayapi-2" in the "name" input
    And user types "default" in the "addName_0" input
    And user types "bookinfo-istio-system.apps.ocp4-kqe1.maistra.upshift.redhat.com" in the "addHostname_0" input
    And user types "80" in the "addPort_0" input
    And user adds a hostname
    And user chooses "Hostname" mode from the "addType_0" select
    And user types "google.com" in the "addValue_0" input
    And user previews the configuration
    And user creates the istio config
    Then the "K8sGateway" "gatewayapi-1" should be listed in "bookinfo" namespace
    And the "K8sGateway" "gatewayapi-2" should be listed in "bookinfo" namespace
    And the "gatewayapi-1" "K8sGateway" of the "bookinfo" namespace should have a "warning"
    And the "gatewayapi-2" "K8sGateway" of the "bookinfo" namespace should have a "warning"
    When viewing the detail for "gatewayapi-1"
    Then "gatewayapi-2" should be referenced
    When user is at the "istio" page
    And viewing the detail for "gatewayapi-2"
    And choosing to delete it
    When user is at the "istio" page
    And user selects the "bookinfo" namespace
    And viewing the detail for "gatewayapi-1"
    When user is at the "istio" page
    And user selects the "bookinfo" namespace
    Then the "K8sGateway" "gatewayapi-2" should not be listed in "bookinfo" namespace
    And the "gatewayapi-1" "K8sGateway" of the "bookinfo" namespace should have a "success"
    When viewing the detail for "gatewayapi-1"
    Then "gatewayapi-2" should not be referenced anymore
