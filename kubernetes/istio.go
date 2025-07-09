package kubernetes

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	api_networking_v1 "istio.io/api/networking/v1"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"
	istio "istio.io/client-go/pkg/clientset/versioned"
	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	inferenceapiclient "sigs.k8s.io/gateway-api-inference-extension/client-go/clientset/versioned"
	k8s_networking_v1 "sigs.k8s.io/gateway-api/apis/v1"
	gatewayapiclient "sigs.k8s.io/gateway-api/pkg/client/clientset/versioned"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util/httputil"
)

const (
	ComponentHealthy     = "Healthy"
	ComponentNotFound    = "NotFound"
	ComponentNotReady    = "NotReady"
	ComponentUnhealthy   = "Unhealthy"
	ComponentUnreachable = "Unreachable"
)

type ComponentStatus struct {
	// Cluster where this component is deployed.
	// Can be the name of external cluster
	Cluster string `json:"cluster"`

	// Namespace where the component is deployed.
	// This field is ignored when marshalling to JSON.
	Namespace string `json:"-"`

	// The workload name of the Istio component.
	//
	// example: istio-ingressgateway
	// required: true
	Name string `json:"name"`

	// The status of an Istio component.
	//
	// example:  Not Found
	// required: true
	Status string `json:"status"`

	// When true, the component is necessary for Istio to function. Otherwise, it is an addon.
	//
	// example:  true
	// required: true
	IsCore bool `json:"isCore"`
}

type IstioComponentStatus []ComponentStatus

func (ics *IstioComponentStatus) Merge(cs IstioComponentStatus) IstioComponentStatus {
	*ics = append(*ics, cs...)
	return *ics
}

const (
	envoyAdminPort = 15000
)

var (
	portNameMatcher = regexp.MustCompile(`^[\-].*`)
	// UDP protocol is not proxied, but it is functional. keeping it in protocols list not to cause UI issues.
	portProtocols = [...]string{"grpc", "grpc-web", "http", "http2", "https", "mongo", "redis", "tcp", "tls", "udp", "mysql"}
)

type IstioClientInterface interface {
	Istio() istio.Interface
	// GatewayAPI returns the gateway-api kube client.
	GatewayAPI() gatewayapiclient.Interface

	// InferenceAPI returns the inference-extensions-api kube client.
	InferenceAPI() inferenceapiclient.Interface

	GetConfigDump(namespace, podName string) (*ConfigDump, error)
}

type IstioUserClientInterface interface {
	IstioClientInterface
	SetProxyLogLevel(namespace, podName, level string) error
}

func (in *K8SClient) Istio() istio.Interface {
	return in.istioClientset
}

func (in *K8SClient) GatewayAPI() gatewayapiclient.Interface {
	return in.gatewayapi
}

func (in *K8SClient) InferenceAPI() inferenceapiclient.Interface {
	return in.inferenceapi
}

func (in *K8SClient) GetConfigDump(namespace, podName string) (*ConfigDump, error) {
	// Fetching the Config Dump from the pod's Envoy.
	// The port 15000 is open on each Envoy Sidecar (managed by Istio) to serve the Envoy Admin  interface.
	// This port can only be accessed by inside the pod.
	// See the Istio's doc page about its port usage:
	// https://istio.io/latest/docs/ops/deployment/requirements/#ports-used-by-istio
	resp, err := in.ForwardGetRequest(namespace, podName, 15000, "/config_dump")
	if err != nil {
		log.Errorf("Error forwarding the /config_dump request: %v", err)
		return nil, err
	}

	cd := &ConfigDump{}
	err = json.Unmarshal(resp, cd)
	if err != nil {
		log.Errorf("Error Unmarshalling the config_dump: %v", err)
	}

	return cd, err
}

func (in *K8SClient) SetProxyLogLevel(namespace, pod, level string) error {
	path := fmt.Sprintf("/logging?level=%s", level)

	localPort := httputil.Pool.GetFreePort()
	defer httputil.Pool.FreePort(localPort)
	f, err := in.getPodPortForwarder(namespace, pod, fmt.Sprintf("%d:%d", localPort, envoyAdminPort))
	if err != nil {
		return err
	}

	// Start the forwarding
	if err := f.Start(); err != nil {
		return err
	}

	// Defering the finish of the port-forwarding
	defer f.Stop()

	// Ready to create a request
	url := fmt.Sprintf("http://localhost:%d%s", localPort, path)
	body, code, _, err := httputil.HttpPost(url, nil, nil, time.Second*10, nil, in.conf)
	if code >= 400 {
		log.Errorf("Error whilst posting. Error: %s. Body: %s", err, string(body))
		return fmt.Errorf("error sending post request %s from %s/%s. Response code: %d", path, namespace, pod, code)
	}

	return err
}

// ServiceEntryHostnames returns a list of hostnames defined in the ServiceEntries Specs. Key in the resulting map is the protocol (in lowercase) + hostname
// exported for test
func ServiceEntryHostnames(serviceEntries []*networking_v1.ServiceEntry) map[string][]string {
	hostnames := make(map[string][]string)

	for _, serviceEntry := range serviceEntries {
		for _, host := range serviceEntry.Spec.Hosts {
			protocols := make([]string, 0, len(serviceEntry.Spec.Ports))
			for _, port := range serviceEntry.Spec.Ports {
				protocol := mapPortToVirtualServiceProtocol(port.Protocol)
				protocols = append(protocols, protocol)
			}
			hostnames[host] = append(protocols, hostnames[host]...)
		}
	}

	return hostnames
}

// mapPortToVirtualServiceProtocol transforms Istio's Port-definitions' protocol names to VirtualService's protocol names
func mapPortToVirtualServiceProtocol(proto string) string {
	// http: HTTP/HTTP2/GRPC/ TLS-terminated-HTTPS and service entry ports using HTTP/HTTP2/GRPC protocol
	// tls: HTTPS/TLS protocols (i.e. with “passthrough” TLS mode) and service entry ports using HTTPS/TLS protocols.
	// tcp: everything else

	switch proto {
	case "HTTP":
		fallthrough
	case "HTTP2":
		fallthrough
	case "GRPC":
		return "http"
	case "HTTPS":
		fallthrough
	case "TLS":
		return "tls"
	default:
		return "tcp"
	}
}

// ValidatePort parses the Istio Port definition and validates the naming scheme
func ValidatePort(portDef *api_networking_v1.Port) bool {
	if portDef == nil {
		return false
	}
	return MatchPortNameRule(portDef.Name, portDef.Protocol)
}

// ValidateServicePort parses the Istio Port definition and validates the naming scheme
func ValidateServicePort(portDef *api_networking_v1.ServicePort) bool {
	if portDef == nil {
		return false
	}
	return MatchPortNameRule(portDef.Name, portDef.Protocol)
}

func MatchPortNameRule(portName, protocol string) bool {
	protocol = strings.ToLower(protocol)
	// Check that portName begins with the protocol
	if protocol == "tcp" || protocol == "udp" {
		// TCP and UDP protocols do not care about the name
		return true
	}

	if !strings.HasPrefix(portName, protocol) {
		return false
	}

	// If longer than protocol, then it must adhere to <protocol>[-suffix]
	// and if there's -, then there must be a suffix ..
	if len(portName) > len(protocol) {
		restPortName := portName[len(protocol):]
		return portNameMatcher.MatchString(restPortName)
	}

	// Case portName == protocolName
	return true
}

func MatchPortNameWithValidProtocols(portName string) bool {
	for _, protocol := range portProtocols {
		if strings.HasPrefix(portName, protocol) &&
			(strings.ToLower(portName) == protocol || portNameMatcher.MatchString(portName[len(protocol):])) {
			return true
		}
	}
	return false
}

func MatchPortAppProtocolWithValidProtocols(appProtocol *string) bool {
	if appProtocol == nil || *appProtocol == "" {
		return false
	}
	for _, protocol := range portProtocols {
		if strings.ToLower(*appProtocol) == protocol {
			return true
		}
	}
	return false
}

// GatewayNames extracts the gateway names for easier matching
func GatewayNames(gateways []*networking_v1.Gateway, conf *config.Config) map[string]struct{} {
	var empty struct{}
	names := make(map[string]struct{})
	for _, gw := range gateways {
		names[ParseHost(gw.Name, gw.Namespace, conf).String()] = empty
	}
	return names
}

// K8sGatewayNames extracts the gateway names for easier matching
func K8sGatewayNames(gateways []*k8s_networking_v1.Gateway, conf *config.Config) map[string]k8s_networking_v1.Gateway {
	names := make(map[string]k8s_networking_v1.Gateway)
	for _, gw := range gateways {
		names[ParseHost(gw.Name, gw.Namespace, conf).String()] = *gw
	}
	return names
}

func PeerAuthnHasStrictMTLS(peerAuthn *security_v1.PeerAuthentication) bool {
	_, mode := PeerAuthnHasMTLSEnabled(peerAuthn)
	return mode == "STRICT"
}

func PeerAuthnHasMTLSEnabled(peerAuthn *security_v1.PeerAuthentication) (bool, string) {
	// It is no globally enabled when has targets
	if peerAuthn.Spec.Selector != nil && len(peerAuthn.Spec.Selector.MatchLabels) >= 0 {
		return false, ""
	}
	return PeerAuthnMTLSMode(peerAuthn)
}

func PeerAuthnMTLSMode(peerAuthn *security_v1.PeerAuthentication) (bool, string) {
	// It is globally enabled when mtls is in STRICT mode
	if peerAuthn.Spec.Mtls != nil {
		mode := peerAuthn.Spec.Mtls.Mode.String()
		return mode == "STRICT" || mode == "PERMISSIVE", mode
	}
	return false, ""
}

func DestinationRuleHasMeshWideMTLSEnabled(destinationRule *networking_v1.DestinationRule) (bool, string) {
	// Following the suggested procedure to enable mesh-wide mTLS, host might be '*.local':
	// https://istio.io/docs/tasks/security/authn-policy/#globally-enabling-istio-mutual-tls
	return DestinationRuleHasMTLSEnabledForHost("*.local", destinationRule)
}

func DestinationRuleHasNamespaceWideMTLSEnabled(namespace string, destinationRule *networking_v1.DestinationRule, conf *config.Config) (bool, string) {
	// Following the suggested procedure to enable namespace-wide mTLS, host might be '*.namespace.svc.cluster.local'
	// https://istio.io/docs/tasks/security/authn-policy/#namespace-wide-policy
	nsHost := fmt.Sprintf("*.%s.%s", namespace, conf.ExternalServices.Istio.IstioIdentityDomain)
	return DestinationRuleHasMTLSEnabledForHost(nsHost, destinationRule)
}

func DestinationRuleHasMTLSEnabledForHost(expectedHost string, destinationRule *networking_v1.DestinationRule) (bool, string) {
	if destinationRule.Spec.Host == "" || destinationRule.Spec.Host != expectedHost {
		return false, ""
	}
	return DestinationRuleHasMTLSEnabled(destinationRule)
}

func DestinationRuleHasMTLSEnabled(destinationRule *networking_v1.DestinationRule) (bool, string) {
	if destinationRule.Spec.TrafficPolicy != nil && destinationRule.Spec.TrafficPolicy.Tls != nil {
		mode := destinationRule.Spec.TrafficPolicy.Tls.Mode.String()
		return mode == "ISTIO_MUTUAL", mode
	}
	return false, ""
}

// ClusterNameFromIstiod attempts to resolve the cluster info of the "home" cluster where kiali is running
// by inspecting the istiod deployment. Assumes that the istiod deployment is in the same cluster as the kiali pod.
func ClusterNameFromIstiod(conf config.Config, k8s ClientInterface) (string, error) {
	// The "cluster_id" is set in an environment variable of
	// the "istiod" deployment. Let's try to fetch it.
	var istiodDeployment *appsv1.Deployment
	if istiodDeploymentName := conf.ExternalServices.Istio.IstiodDeploymentName; istiodDeploymentName != "" {
		deployment, err := k8s.GetDeployment(conf.IstioNamespace, istiodDeploymentName)
		if err != nil {
			return "", err
		}

		istiodDeployment = deployment
	} else {
		istiodDeployments, err := k8s.GetDeployments(conf.IstioNamespace, metav1.ListOptions{LabelSelector: "app=istiod"})
		if err != nil {
			return "", err
		}

		if len(istiodDeployments) == 0 {
			return "", fmt.Errorf("istiod deployment not found in namespace [%s]", conf.IstioNamespace)
		}

		// Just take the first one since they should all have the same cluster id.
		istiodDeployment = &istiodDeployments[0]
	}

	istiodContainers := istiodDeployment.Spec.Template.Spec.Containers
	if len(istiodContainers) == 0 {
		return "", fmt.Errorf("istiod deployment [%s] has no containers", istiodDeployment.Name)
	}

	clusterName := ""
	for _, v := range istiodContainers[0].Env {
		if v.Name == "CLUSTER_ID" {
			clusterName = v.Value
			break
		}
	}

	if clusterName == "" {
		// We didn't find it. This may mean that Istio is not setup with multi-cluster enabled.
		return "", fmt.Errorf("istiod deployment [%s] does not have the CLUSTER_ID environment variable set", istiodDeployment.Name)
	}

	return clusterName, nil
}
