package kubernetes

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"

	"gopkg.in/yaml.v2"
	api_networking_v1beta1 "istio.io/api/networking/v1beta1"
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"
	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
	security_v1beta1 "istio.io/client-go/pkg/apis/security/v1beta1"
	istio "istio.io/client-go/pkg/clientset/versioned"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util/httputil"
)

const (
	envoyAdminPort = 15000
)

var (
	portNameMatcher = regexp.MustCompile(`^[\-].*`)
	portProtocols   = [...]string{"grpc", "http", "http2", "https", "mongo", "redis", "tcp", "tls", "udp", "mysql"}
)

type IstioClientInterface interface {
	Istio() istio.Interface

	GetProxyStatus() ([]*ProxyStatus, error)
	GetConfigDump(namespace, podName string) (*ConfigDump, error)
	SetProxyLogLevel(namespace, podName, level string) error
	GetRegistryConfiguration() (*RegistryConfiguration, error)
	GetRegistryEndpoints() ([]*RegistryEndpoint, error)
	GetRegistryServices() ([]*RegistryService, error)
}

func (in *K8SClient) Istio() istio.Interface {
	return in.istioClientset
}

func (in *K8SClient) getIstiodDebugStatus(debugPath string) (map[string][]byte, error) {
	c := config.Get()
	istiods, err := in.GetPods(c.IstioNamespace, labels.Set(map[string]string{
		"app": "istiod",
	}).String())

	if err != nil {
		return nil, err
	}

	healthyIstiods := make([]*core_v1.Pod, 0, len(istiods))
	for i, istiod := range istiods {
		if istiod.Status.Phase == "Running" {
			healthyIstiods = append(healthyIstiods, &istiods[i])
		}
	}

	if len(healthyIstiods) == 0 {
		return nil, errors.New("unable to find any healthy Pilot instance")
	}

	// Pulling an open port from the port pool
	freePort := httputil.Pool.GetFreePort()
	defer httputil.Pool.FreePort(freePort)

	// Check if the kube-api has proxy access to pods in the istio-system
	// https://github.com/kiali/kiali/issues/3494#issuecomment-772486224
	// The 8080 port is not accessible from outside of the pod. However, it is used for kubernetes to do the live probes.
	// Using the port-forwarding, the call is made as it was in the pod itself, as a localhost call.
	// Also the port-forwarding to a pod is done via the KubeAPI. Therefore if the call doesn't return any error,
	// it means that Kiali has access to the KubeAPI and that the KubeAPI has access to the Istiod (control plane).
	_, err = in.ForwardGetRequest(c.IstioNamespace, istiods[0].Name, freePort, 8080, "/ready")
	if err != nil {
		return nil, fmt.Errorf("unable to proxy Istiod pods. " +
			"Make sure your Kubernetes API server has access to the Istio control plane through 8080 port")
	}

	wg := sync.WaitGroup{}
	wg.Add(len(healthyIstiods))
	errChan := make(chan error, len(healthyIstiods))
	syncChan := make(chan map[string][]byte, len(healthyIstiods))

	result := map[string][]byte{}
	for _, istiod := range healthyIstiods {
		go func(name, namespace string) {
			defer wg.Done()

			// Pulling an open port from the port pool
			freePort := httputil.Pool.GetFreePort()
			defer httputil.Pool.FreePort(freePort)

			// The 15014 port on Istiod is open for control plane monitoring.
			// Here's the Istio doc page about the port usage by istio:
			// https://istio.io/latest/docs/ops/deployment/requirements/#ports-used-by-istio
			res, err := in.ForwardGetRequest(namespace, name, freePort, c.ExternalServices.Istio.IstiodPodMonitoringPort, debugPath)
			if err != nil {
				errChan <- fmt.Errorf("%s: %s", name, err.Error())
			} else {
				syncChan <- map[string][]byte{name: res}
			}
		}(istiod.Name, istiod.Namespace)
	}

	wg.Wait()
	close(errChan)
	close(syncChan)

	errs := ""
	for err := range errChan {
		if errs != "" {
			errs = errs + "; "
		}
		errs = errs + err.Error()
	}
	errs = "Error fetching the proxy-status in the following pods: " + errs

	for status := range syncChan {
		for pilot, sync := range status {
			result[pilot] = sync
		}
	}

	if len(result) > 0 {
		return result, nil
	} else {
		return nil, errors.New(errs)
	}
}

func (in *K8SClient) GetProxyStatus() ([]*ProxyStatus, error) {
	synczPath := "/debug/syncz"
	result, err := in.getIstiodDebugStatus(synczPath)
	if err != nil {
		return nil, err
	}
	return parseProxyStatus(result)
}

func (in *K8SClient) GetRegistryServices() ([]*RegistryService, error) {
	registryzPath := "/debug/registryz"
	result, err := in.getIstiodDebugStatus(registryzPath)
	if err != nil {
		log.Errorf("Failed to call Istiod endpoint %s error: %s", registryzPath, err)
		return nil, err
	}
	return ParseRegistryServices(result)
}

func (in *K8SClient) GetRegistryEndpoints() ([]*RegistryEndpoint, error) {
	endpointzPath := "/debug/endpointz"
	result, err := in.getIstiodDebugStatus(endpointzPath)
	if err != nil {
		log.Errorf("Failed to call Istiod endpoint %s error: %s", endpointzPath, err)
		return nil, err
	}
	return ParseRegistryEndpoints(result)
}

func (in *K8SClient) GetRegistryConfiguration() (*RegistryConfiguration, error) {
	configzPath := "/debug/configz"
	result, err := in.getIstiodDebugStatus(configzPath)
	if err != nil {
		log.Errorf("Failed to call Istiod endpoint %s error: %s", configzPath, err)
		return nil, err
	}
	return ParseRegistryConfig(result)
}

func parseProxyStatus(statuses map[string][]byte) ([]*ProxyStatus, error) {
	var fullStatus []*ProxyStatus
	for pilot, status := range statuses {
		var ss []*ProxyStatus
		err := json.Unmarshal(status, &ss)
		if err != nil {
			return nil, err
		}
		for _, s := range ss {
			s.pilot = pilot
		}
		fullStatus = append(fullStatus, ss...)
	}
	return fullStatus, nil
}

func ParseRegistryServices(registries map[string][]byte) ([]*RegistryService, error) {
	var fullRegistryServices []*RegistryService
	isRegistryLoaded := false
	for pilot, registry := range registries {
		// skip reading registry configs multiple times in a case of multiple istiod pods
		if isRegistryLoaded {
			break
		}
		var rr []*RegistryService
		err := json.Unmarshal(registry, &rr)
		if err != nil {
			log.Errorf("Error parsing RegistryServices results: %s", err)
			return nil, err
		}
		for _, r := range rr {
			r.pilot = pilot
		}
		fullRegistryServices = append(fullRegistryServices, rr...)
		if len(rr) > 0 {
			isRegistryLoaded = true
		}
	}
	return fullRegistryServices, nil
}

func ParseRegistryEndpoints(endpoints map[string][]byte) ([]*RegistryEndpoint, error) {
	var fullRegistryEndpoints []*RegistryEndpoint
	isRegistryLoaded := false
	for pilot, endpoint := range endpoints {
		// skip reading registry endpoints multiple times in a case of multiple istiod pods
		if isRegistryLoaded {
			break
		}
		var eps []*RegistryEndpoint
		err := json.Unmarshal(endpoint, &eps)
		if err != nil {
			log.Errorf("Error parsing RegistryEndpoints results: %s", err)
			return nil, err
		}
		for _, ep := range eps {
			ep.pilot = pilot
		}
		fullRegistryEndpoints = append(fullRegistryEndpoints, eps...)
		if len(eps) > 0 {
			isRegistryLoaded = true
		}
	}
	return fullRegistryEndpoints, nil
}

func ParseRegistryConfig(config map[string][]byte) (*RegistryConfiguration, error) {
	registry := RegistryConfiguration{
		DestinationRules: []networking_v1beta1.DestinationRule{},
		EnvoyFilters:     []networking_v1alpha3.EnvoyFilter{},
		Gateways:         []networking_v1beta1.Gateway{},
		VirtualServices:  []networking_v1beta1.VirtualService{},
		ServiceEntries:   []networking_v1beta1.ServiceEntry{},
		Sidecars:         []networking_v1beta1.Sidecar{},
		WorkloadEntries:  []networking_v1beta1.WorkloadEntry{},
		WorkloadGroups:   []networking_v1beta1.WorkloadGroup{},

		AuthorizationPolicies:  []security_v1beta1.AuthorizationPolicy{},
		PeerAuthentications:    []security_v1beta1.PeerAuthentication{},
		RequestAuthentications: []security_v1beta1.RequestAuthentication{},
	}
	isRegistryLoaded := false
	for istiod, bRegistry := range config {
		// skip reading registry configs multiple times in a case of multiple istiod pods
		if isRegistryLoaded {
			break
		}
		r := bytes.NewReader(bRegistry)
		dec := json.NewDecoder(r)
		var jRegistry interface{}
		err := dec.Decode(&jRegistry)
		if err != nil {
			log.Errorf("Error parsing RegistryConfig results for %s: %s", istiod, err)
			return nil, err
		}
		if ajRegistry, ok := jRegistry.([]interface{}); ok {
			for _, iItem := range ajRegistry {
				if mItem, ok := iItem.(map[string]interface{}); ok {
					kind := mItem["kind"].(string)
					switch kind {
					case "DestinationRule", "EnvoyFilter", "Gateway", "ServiceEntry", "Sidecar", "VirtualService", "WorkloadEntry", "WorkloadGroup", "AuthorizationPolicy", "PeerAuthentication", "RequestAuthentication":
						bItem, err := json.Marshal(iItem)
						rbItem := bytes.NewReader(bItem)
						bDec := json.NewDecoder(rbItem)
						if err != nil {
							log.Errorf("Error parsing RegistryConfig results for %s: %s", istiod, err)
							return nil, err
						}
						switch kind {
						case "DestinationRule":
							var dr networking_v1beta1.DestinationRule
							err := bDec.Decode(&dr)
							if err != nil {
								log.Errorf("Error parsing RegistryConfig results for DestinationRule: %s", err)
							}
							registry.DestinationRules = append(registry.DestinationRules, dr)
						case "EnvoyFilter":
							var ef networking_v1alpha3.EnvoyFilter
							err := bDec.Decode(&ef)
							if err != nil {
								log.Errorf("Error parsing RegistryConfig results for EnvoyFilter: %s", err)
							}
							registry.EnvoyFilters = append(registry.EnvoyFilters, ef)
						case "Gateway":
							var gw networking_v1beta1.Gateway
							err := bDec.Decode(&gw)
							if err != nil {
								log.Errorf("Error parsing RegistryConfig results for Gateways: %s", err)
							}
							registry.Gateways = append(registry.Gateways, gw)
						case "ServiceEntry":
							var se networking_v1beta1.ServiceEntry
							err := bDec.Decode(&se)
							if err != nil {
								log.Errorf("Error parsing RegistryConfig results for Gateways: %s", err)
							}
							registry.ServiceEntries = append(registry.ServiceEntries, se)
						case "Sidecar":
							var sc networking_v1beta1.Sidecar
							err := bDec.Decode(&sc)
							if err != nil {
								log.Errorf("Error parsing RegistryConfig results for Gateways: %s", err)
							}
							registry.Sidecars = append(registry.Sidecars, sc)
						case "VirtualService":
							var vs networking_v1beta1.VirtualService
							err := bDec.Decode(&vs)
							if err != nil {
								log.Errorf("Error parsing RegistryConfig results for Gateways: %s", err)
							}
							registry.VirtualServices = append(registry.VirtualServices, vs)
						case "WorkloadEntry":
							var we networking_v1beta1.WorkloadEntry
							err := bDec.Decode(&we)
							if err != nil {
								log.Errorf("Error parsing RegistryConfig results for Gateways: %s", err)
							}
							registry.WorkloadEntries = append(registry.WorkloadEntries, we)
						case "WorkloadGroup":
							var wg networking_v1beta1.WorkloadGroup
							err := bDec.Decode(&wg)
							if err != nil {
								log.Errorf("Error parsing RegistryConfig results for WorkloadGroup: %s", err)
							}
							registry.WorkloadGroups = append(registry.WorkloadGroups, wg)
						case "AuthorizationPolicy":
							var ap security_v1beta1.AuthorizationPolicy
							err := bDec.Decode(&ap)
							if err != nil {
								log.Errorf("Error parsing RegistryConfig results for AuthorizationPolicies: %s", err)
							}
							registry.AuthorizationPolicies = append(registry.AuthorizationPolicies, ap)
						case "PeerAuthentication":
							var pa security_v1beta1.PeerAuthentication
							err := bDec.Decode(&pa)
							if err != nil {
								log.Errorf("Error parsing RegistryConfig results for AuthorizationPolicies: %s", err)
							}
							registry.PeerAuthentications = append(registry.PeerAuthentications, pa)
						case "RequestAuthentication":
							var ra security_v1beta1.RequestAuthentication
							err := bDec.Decode(&ra)
							if err != nil {
								log.Errorf("Error parsing RegistryConfig results for RequestAuthentication: %s", err)
							}
							registry.RequestAuthentications = append(registry.RequestAuthentications, ra)
						}
					default:
						// Kiali only parses the registry configuration that are needed
					}
				}
			}
		}
		isRegistryLoaded = true
	}
	return &registry, nil
}

func (in *K8SClient) GetConfigDump(namespace, podName string) (*ConfigDump, error) {
	// Pulling an open port from the port pool
	freePort := httputil.Pool.GetFreePort()
	defer httputil.Pool.FreePort(freePort)

	// Fetching the Config Dump from the pod's Envoy.
	// The port 15000 is open on each Envoy Sidecar (managed by Istio) to serve the Envoy Admin  interface.
	// This port can only be accessed by inside the pod.
	// See the Istio's doc page about its port usage:
	// https://istio.io/latest/docs/ops/deployment/requirements/#ports-used-by-istio
	resp, err := in.ForwardGetRequest(namespace, podName, freePort, 15000, "/config_dump")
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
	f, err := in.GetPodPortForwarder(namespace, pod, fmt.Sprintf("%d:%d", localPort, envoyAdminPort))
	if err != nil {
		return err
	}

	// Start the forwarding
	if err := (*f).Start(); err != nil {
		return err
	}

	// Defering the finish of the port-forwarding
	defer (*f).Stop()

	// Ready to create a request
	url := fmt.Sprintf("http://localhost:%d%s", localPort, path)
	body, code, _, err := httputil.HttpPost(url, nil, nil, time.Second*10, nil)
	if code >= 400 {
		log.Errorf("Error whilst posting. Error: %s. Body: %s", err, string(body))
		return fmt.Errorf("error sending post request %s from %s/%s. Response code: %d", path, namespace, pod, code)
	}

	return err
}

func GetIstioConfigMap(istioConfig *core_v1.ConfigMap) (*IstioMeshConfig, error) {
	meshConfig := &IstioMeshConfig{}

	// Used for test cases
	if istioConfig == nil || istioConfig.Data == nil {
		return meshConfig, nil
	}

	var err error
	meshConfigYaml, ok := istioConfig.Data["mesh"]
	log.Tracef("meshConfig: %v", meshConfigYaml)
	if !ok {
		errMsg := "GetIstioConfigMap: Cannot find Istio mesh configuration [%v]."
		log.Warningf(errMsg, istioConfig)
		return nil, fmt.Errorf(errMsg, istioConfig)
	}

	err = yaml.Unmarshal([]byte(meshConfigYaml), &meshConfig)
	if err != nil {
		log.Warningf("GetIstioConfigMap: Cannot read Istio mesh configuration.")
		return nil, err
	}
	return meshConfig, nil
}

// ServiceEntryHostnames returns a list of hostnames defined in the ServiceEntries Specs. Key in the resulting map is the protocol (in lowercase) + hostname
// exported for test
func ServiceEntryHostnames(serviceEntries []networking_v1beta1.ServiceEntry) map[string][]string {
	hostnames := make(map[string][]string)

	for _, v := range serviceEntries {
		for _, host := range v.Spec.Hosts {
			hostnames[host] = make([]string, 0, 1)
		}
		for _, port := range v.Spec.Ports {
			protocol := mapPortToVirtualServiceProtocol(port.Protocol)
			for host := range hostnames {
				hostnames[host] = append(hostnames[host], protocol)
			}
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

// ValidaPort parses the Istio Port definition and validates the naming scheme
func ValidatePort(portDef *api_networking_v1beta1.Port) bool {
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
func GatewayNames(gateways []networking_v1beta1.Gateway) map[string]struct{} {
	var empty struct{}
	names := make(map[string]struct{})
	for _, gw := range gateways {
		clusterName := gw.ClusterName
		if clusterName == "" {
			clusterName = config.Get().ExternalServices.Istio.IstioIdentityDomain
		}
		names[ParseHost(gw.Name, gw.Namespace, clusterName).String()] = empty
	}
	return names
}

func PeerAuthnHasStrictMTLS(peerAuthn security_v1beta1.PeerAuthentication) bool {
	_, mode := PeerAuthnHasMTLSEnabled(peerAuthn)
	return mode == "STRICT"
}

func PeerAuthnHasMTLSEnabled(peerAuthn security_v1beta1.PeerAuthentication) (bool, string) {
	// It is no globally enabled when has targets
	if peerAuthn.Spec.Selector != nil && len(peerAuthn.Spec.Selector.MatchLabels) >= 0 {
		return false, ""
	}
	return PeerAuthnMTLSMode(peerAuthn)
}

func PeerAuthnMTLSMode(peerAuthn security_v1beta1.PeerAuthentication) (bool, string) {
	// It is globally enabled when mtls is in STRICT mode
	if peerAuthn.Spec.Mtls != nil {
		mode := peerAuthn.Spec.Mtls.Mode.String()
		return mode == "STRICT" || mode == "PERMISSIVE", mode
	}
	return false, ""
}

func DestinationRuleHasMeshWideMTLSEnabled(destinationRule networking_v1beta1.DestinationRule) (bool, string) {
	// Following the suggested procedure to enable mesh-wide mTLS, host might be '*.local':
	// https://istio.io/docs/tasks/security/authn-policy/#globally-enabling-istio-mutual-tls
	return DestinationRuleHasMTLSEnabledForHost("*.local", destinationRule)
}

func DestinationRuleHasNamespaceWideMTLSEnabled(namespace string, destinationRule networking_v1beta1.DestinationRule) (bool, string) {
	// Following the suggested procedure to enable namespace-wide mTLS, host might be '*.namespace.svc.cluster.local'
	// https://istio.io/docs/tasks/security/authn-policy/#namespace-wide-policy
	nsHost := fmt.Sprintf("*.%s.%s", namespace, config.Get().ExternalServices.Istio.IstioIdentityDomain)
	return DestinationRuleHasMTLSEnabledForHost(nsHost, destinationRule)
}

func DestinationRuleHasMTLSEnabledForHost(expectedHost string, destinationRule networking_v1beta1.DestinationRule) (bool, string) {
	if destinationRule.Spec.Host == "" || destinationRule.Spec.Host != expectedHost {
		return false, ""
	}
	return DestinationRuleHasMTLSEnabled(destinationRule)
}

func DestinationRuleHasMTLSEnabled(destinationRule networking_v1beta1.DestinationRule) (bool, string) {
	if destinationRule.Spec.TrafficPolicy != nil && destinationRule.Spec.TrafficPolicy.Tls != nil {
		mode := destinationRule.Spec.TrafficPolicy.Tls.Mode.String()
		return mode == "ISTIO_MUTUAL", mode
	}
	return false, ""
}
