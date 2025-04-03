package gateways

import (
	"regexp"
	"strconv"
	"strings"

	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type MultiMatchChecker struct {
	Cluster   string
	Conf      *config.Config
	Gateways  []*networking_v1.Gateway
	regexpMap map[string]regexp.Regexp
}

const (
	wildCardMatch          = "*"
	targetNamespaceAll     = "*"
	targetNamespaceCurrent = "."
)

type Host struct {
	Gateway         *networking_v1.Gateway
	HostIndex       int
	Name            string
	ServerIndex     int
	TargetNamespace string
}

// hostMatchKey groups hosts that match already match on Port and Selector, so
// that we can perform matching on smaller sets of hosts
type hostMatchKey = struct {
	Port     uint32
	Selector string
}

// hostMatchMap groups hosts that minimally match on the hostMatchKey fields
type hostMatchMap map[hostMatchKey][]Host

// Check validates that no two gateways share the same host+port combination
func (m MultiMatchChecker) Check() models.IstioValidations {
	hostMap := hostMatchMap{}
	hostKey := hostMatchKey{}
	validations := models.IstioValidations{}
	m.regexpMap = map[string]regexp.Regexp{}

	// first, collect all of the gateway hosts and group together those that need to be checked
	// against each other.
	for _, gw := range m.Gateways {
		hostKey.Selector = ""
		if len(gw.Spec.Selector) > 0 {
			hostKey.Selector = labels.Set(gw.Spec.Selector).String()
		}

		for serverIndex, server := range gw.Spec.Servers {
			if server == nil {
				continue
			}

			hostKey.Port = 0
			if server.Port != nil {
				hostKey.Port = server.Port.Number
			}

			for hostIndex, serverHost := range server.Hosts {
				host := Host{
					Gateway:         gw,
					HostIndex:       hostIndex,
					Name:            serverHost,
					ServerIndex:     serverIndex,
					TargetNamespace: targetNamespaceAll,
				}
				// host can be given in <target-namespace>/host syntax
				namespaceAndHost := strings.Split(serverHost, "/")
				if len(namespaceAndHost) > 1 {
					host.Name = namespaceAndHost[1]
					host.TargetNamespace = namespaceAndHost[0]
					// replace targetNamespaceCurrent with GW namespace to simplify duplicate checking
					if host.TargetNamespace == targetNamespaceCurrent {
						host.TargetNamespace = gw.Namespace
					}
				}
				if hosts, found := hostMap[hostKey]; found {
					hostMap[hostKey] = append(hosts, host)
				} else {
					hostMap[hostKey] = []Host{host}
				}
			}
		}
	}

	// second, look for matches for each grouped set of hosts
	for _, hosts := range hostMap {
		for i, host := range hosts {
			if len(hosts) == i+1 {
				break
			}
			hasDuplicates, duplicates := m.findMatch(host, hosts[i+1:])
			if hasDuplicates {
				hostValidationError := newValidationError(host.Gateway.Name, host.Gateway.Namespace, m.Cluster, host.ServerIndex, host.HostIndex)
				existingHosts := make(map[string]bool)

				for _, duplicate := range duplicates {
					existingHostKey := duplicate.Gateway.Namespace + "/" + duplicate.Gateway.Name

					// skip duplicate references when one gateway has several duplicate hosts
					if (duplicate.Gateway.Namespace == host.Gateway.Namespace && duplicate.Gateway.Name == host.Gateway.Name) || existingHosts[existingHostKey] {
						continue
					}

					existingHosts[existingHostKey] = true
					refValidation := newValidationError(duplicate.Gateway.Name, duplicate.Gateway.Namespace, m.Cluster, duplicate.ServerIndex, duplicate.HostIndex)
					refValidation = refValidation.MergeReferences(hostValidationError)
					hostValidationError = hostValidationError.MergeReferences(refValidation)
					validations = validations.MergeValidations(refValidation)
				}
				validations = validations.MergeValidations(hostValidationError)
			}
		}
	}

	return validations
}

func newValidationError(gatewayName, namespace, cluster string, serverIndex, hostIndex int) models.IstioValidations {
	key := models.IstioValidationKey{Name: gatewayName, Namespace: namespace, ObjectGVK: kubernetes.Gateways, Cluster: cluster}
	checks := models.Build("gateways.multimatch",
		"spec/servers["+strconv.Itoa(serverIndex)+"]/hosts["+strconv.Itoa(hostIndex)+"]")
	rrValidation := &models.IstioValidation{
		Cluster:   cluster,
		Name:      gatewayName,
		ObjectGVK: key.ObjectGVK,
		Valid:     true,
		Checks: []*models.IstioCheck{
			&checks,
		},
	}

	return models.IstioValidations{key: rrValidation}
}

// findMatch uses a linear search with regexp to check for matching gateway host + port combinations. If this becomes a bottleneck for performance, replace with a graph or trie algorithm.
func (m MultiMatchChecker) findMatch(host Host, otherHosts []Host) (bool, []Host) {
	duplicates := make([]Host, 0)
	skipWild := m.Conf.KialiFeatureFlags.Validations.SkipWildcardGatewayHosts

	for _, other := range otherHosts {
		// only compare hosts that share the target namespace or hosts where at least one is exported to all namespaces
		if host.TargetNamespace != other.TargetNamespace && host.TargetNamespace != targetNamespaceAll && other.TargetNamespace != targetNamespaceAll {
			continue
		}
		// wildcardMatches will always match unless SkipWildcardGatewayHosts is set 'true'
		if host.Name == wildCardMatch || other.Name == wildCardMatch {
			if !skipWild {
				duplicates = append(duplicates, host)
				duplicates = append(duplicates, other)
			}
			continue
		}

		// DNS is case-insensitive
		hostName := strings.ToLower(host.Name)
		otherName := strings.ToLower(other.Name)

		// avoid regex if it's simple equality
		if hostName == otherName {
			duplicates = append(duplicates, host)
			duplicates = append(duplicates, other)
			continue
		}

		// lazily compile hostname Regex
		hostRegexp, ok := m.regexpMap[hostName]
		if !ok {
			hostRegexp = *regexpFromHostname(hostName)
			m.regexpMap[hostName] = hostRegexp
		}
		otherRegexp, ok := m.regexpMap[otherName]
		if !ok {
			otherRegexp = *regexpFromHostname(otherName)
			m.regexpMap[otherName] = otherRegexp
		}

		if hostRegexp.MatchString(otherName) || otherRegexp.MatchString(hostName) {
			duplicates = append(duplicates, host)
			duplicates = append(duplicates, other)
			continue
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
