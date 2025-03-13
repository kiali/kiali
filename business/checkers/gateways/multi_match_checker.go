package gateways

import (
	"regexp"
	"strconv"
	"strings"

	api_networking_v1 "istio.io/api/networking/v1"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util/intutil"
)

type MultiMatchChecker struct {
	Cluster         string
	Conf            *config.Config
	Gateways        []*networking_v1.Gateway
	existingList    map[string][]Host
	hostRegexpCache map[string]regexp.Regexp
}

const (
	wildCardMatch          = "*"
	targetNamespaceAll     = "*"
	targetNamespaceCurrent = "."
)

type Host struct {
	Port            int
	Hostname        string
	Namespace       string
	ServerIndex     int
	HostIndex       int
	GatewayRuleName string
	TargetNamespace string
}

// Check validates that no two gateways share the same host+port combination
func (m MultiMatchChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}
	m.existingList = map[string][]Host{}
	m.hostRegexpCache = map[string]regexp.Regexp{}

	for _, g := range m.Gateways {
		gatewayRuleName := g.Name
		gatewayNamespace := g.Namespace

		selectorString := ""
		if len(g.Spec.Selector) > 0 {
			selectorString = labels.Set(g.Spec.Selector).String()
		}
		for i, server := range g.Spec.Servers {
			if server == nil {
				continue
			}
			hosts := parsePortAndHostnames(server)
			for hi, host := range hosts {
				host.ServerIndex = i
				host.HostIndex = hi
				host.GatewayRuleName = gatewayRuleName
				host.Namespace = gatewayNamespace
				// Hostname can be given in <target-namespace>/Hostname syntax
				host.TargetNamespace = targetNamespaceAll
				namespaceAndHost := strings.Split(host.Hostname, "/")
				if len(namespaceAndHost) > 1 {
					host.Hostname = namespaceAndHost[1]
					host.TargetNamespace = namespaceAndHost[0]
					// replace targetNamespaceCurrent with GW namespace to simplify duplicate checking
					if host.TargetNamespace == targetNamespaceCurrent {
						host.TargetNamespace = gatewayNamespace
					}
				}
				duplicate, dhosts := m.findMatch(host, selectorString)
				if duplicate {
					// The above is referenced by each one below..
					currentHostValidation := createError(host.GatewayRuleName, host.Namespace, m.Cluster, host.ServerIndex, host.HostIndex)
					existingHosts := make(map[string]bool)
					for i := 0; i < len(dhosts); i++ {
						dh := dhosts[i]
						// we skip CurrentHostValidation
						// skip duplicate references when one gateway has several duplicate hosts
						if (dh.Namespace == gatewayNamespace && dh.GatewayRuleName == gatewayRuleName) || existingHosts[dh.Namespace+"/"+dh.GatewayRuleName] {
							continue
						}
						existingHosts[dh.Namespace+"/"+dh.GatewayRuleName] = true
						refValidation := createError(dh.GatewayRuleName, dh.Namespace, m.Cluster, dh.ServerIndex, dh.HostIndex)
						refValidation = refValidation.MergeReferences(currentHostValidation)
						currentHostValidation = currentHostValidation.MergeReferences(refValidation)
						validations = validations.MergeValidations(refValidation)
					}
					validations = validations.MergeValidations(currentHostValidation)
				}
				m.existingList[selectorString] = append(m.existingList[selectorString], host)
			}
		}
	}

	return validations
}

func createError(gatewayRuleName, namespace, cluster string, serverIndex, hostIndex int) models.IstioValidations {
	key := models.IstioValidationKey{Name: gatewayRuleName, Namespace: namespace, ObjectGVK: kubernetes.Gateways, Cluster: cluster}
	checks := models.Build("gateways.multimatch",
		"spec/servers["+strconv.Itoa(serverIndex)+"]/hosts["+strconv.Itoa(hostIndex)+"]")
	rrValidation := &models.IstioValidation{
		Cluster:   cluster,
		Name:      gatewayRuleName,
		ObjectGVK: key.ObjectGVK,
		Valid:     true,
		Checks: []*models.IstioCheck{
			&checks,
		},
	}

	return models.IstioValidations{key: rrValidation}
}

func parsePortAndHostnames(serverDef *api_networking_v1.Server) []Host {
	var port int
	if serverDef.Port != nil {
		if n, e := intutil.Convert(serverDef.Port.Number); e == nil {
			port = n
		}
	}
	if len(serverDef.Hosts) > 0 {
		hosts := make([]Host, 0, len(serverDef.Hosts))
		for _, hostname := range serverDef.Hosts {
			hosts = append(hosts, Host{
				Port:     port,
				Hostname: hostname,
			})
		}
		return hosts
	}
	return nil
}

// findMatch uses a linear search with regexp to check for matching gateway host + port combinations. If this becomes a bottleneck for performance, replace with a graph or trie algorithm.
func (m MultiMatchChecker) findMatch(host Host, selector string) (bool, []Host) {
	duplicates := make([]Host, 0)

	for groupSelector, hostGroup := range m.existingList {
		if groupSelector != selector {
			continue
		}

		for _, h := range hostGroup {
			// only compare hosts that share the target namespace or hosts where at least one of the pair is exported to all namespaces
			if h.TargetNamespace == targetNamespaceAll || host.TargetNamespace == targetNamespaceAll || h.TargetNamespace == host.TargetNamespace {
				if h.Port == host.Port {
					// wildcardMatches will always match unless SkipWildcardGatewayHosts is set 'true'
					if host.Hostname == wildCardMatch || h.Hostname == wildCardMatch {
						if !m.Conf.KialiFeatureFlags.Validations.SkipWildcardGatewayHosts {
							duplicates = append(duplicates, host)
							duplicates = append(duplicates, h)
						}
						continue
					}

					// DNS is case-insensitive
					current := strings.ToLower(host.Hostname)
					previous := strings.ToLower(h.Hostname)

					// lazily compile hostname Regex
					currentRegexp, ok := m.hostRegexpCache[current]
					if !ok {
						currentRegexp = *regexpFromHostname(current)
						m.hostRegexpCache[current] = currentRegexp
					}
					previousRegexp, ok := m.hostRegexpCache[previous]
					if !ok {
						previousRegexp = *regexpFromHostname(previous)
						m.hostRegexpCache[previous] = previousRegexp
					}

					if currentRegexp.MatchString(previous) ||
						previousRegexp.MatchString(current) {
						duplicates = append(duplicates, host)
						duplicates = append(duplicates, h)
						continue
					}
				}
			}
		}
	}
	return len(duplicates) > 0, duplicates
}

func regexpFromHostname(hostname string) *regexp.Regexp {
	// Escaping dot chars for RegExp. Dot char means all possible chars.
	// This protects this validation to false positive for (api-dev.example.com and api.dev.example.com)
	escaped := strings.Replace(hostname, ".", "\\.", -1)

	// We anchor the beginning and end of the string when it's
	// to be used as a regex, so that we don't get spurious
	// substring matches, e.g., "example.com" matching
	// "foo.example.com".
	anchored := strings.Join([]string{"^", escaped, "$"}, "")

	return regexp.MustCompile(anchored)
}
