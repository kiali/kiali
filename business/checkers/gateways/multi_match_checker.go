package gateways

import (
	"regexp"
	"strconv"
	"strings"

	api_networking_v1alpha3 "istio.io/api/networking/v1alpha3"
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"

	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util/intutil"
)

type MultiMatchChecker struct {
	GatewaysPerNamespace [][]networking_v1alpha3.Gateway
	existingList         map[string][]Host
}

const (
	GatewayCheckerType = "gateway"
	wildCardMatch      = "*"
)

type Host struct {
	Port            int
	Hostname        string
	Namespace       string
	ServerIndex     int
	HostIndex       int
	GatewayRuleName string
}

// Check validates that no two gateways share the same host+port combination
func (m MultiMatchChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}
	m.existingList = map[string][]Host{}

	for _, nsG := range m.GatewaysPerNamespace {
		for _, g := range nsG {
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
					duplicate, dhosts := m.findMatch(host, selectorString)
					if duplicate {
						// The above is referenced by each one below..
						currentHostValidation := createError(host.GatewayRuleName, host.Namespace, host.ServerIndex, host.HostIndex)

						// CurrentHostValidation is always the first one, so we skip it
						for i := 1; i < len(dhosts); i++ {
							dh := dhosts[i]
							refValidation := createError(dh.GatewayRuleName, dh.Namespace, dh.ServerIndex, dh.HostIndex)
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
	}

	return validations
}

func createError(gatewayRuleName, namespace string, serverIndex, hostIndex int) models.IstioValidations {
	key := models.IstioValidationKey{Name: gatewayRuleName, Namespace: namespace, ObjectType: GatewayCheckerType}
	checks := models.Build("gateways.multimatch",
		"spec/servers["+strconv.Itoa(serverIndex)+"]/hosts["+strconv.Itoa(hostIndex)+"]")
	rrValidation := &models.IstioValidation{
		Name:       gatewayRuleName,
		ObjectType: GatewayCheckerType,
		Valid:      true,
		Checks: []*models.IstioCheck{
			&checks,
		},
	}

	return models.IstioValidations{key: rrValidation}
}

func parsePortAndHostnames(serverDef *api_networking_v1alpha3.Server) []Host {
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
			if h.Port == host.Port {
				// wildcardMatches will always match
				if host.Hostname == wildCardMatch || h.Hostname == wildCardMatch {
					duplicates = append(duplicates, host)
					duplicates = append(duplicates, h)
					continue
				}

				// Either one could include wildcards, so we need to check both ways and fix "*" -> ".*" for regexp engine
				current := strings.ToLower(strings.Replace(host.Hostname, "*", ".*", -1))
				previous := strings.ToLower(strings.Replace(h.Hostname, "*", ".*", -1))

				// Escaping dot chars for RegExp. Dot char means all possible chars.
				// This protects this validation to false positive for (api-dev.example.com and api.dev.example.com)
				escapedCurrent := strings.Replace(host.Hostname, ".", "\\.", -1)
				escapedPrevious := strings.Replace(h.Hostname, ".", "\\.", -1)

				// We anchor the beginning and end of the string when it's
				// to be used as a regex, so that we don't get spurious
				// substring matches, e.g., "example.com" matching
				// "foo.example.com".
				currentRegexp := strings.Join([]string{"^", escapedCurrent, "$"}, "")
				previousRegexp := strings.Join([]string{"^", escapedPrevious, "$"}, "")

				if regexp.MustCompile(currentRegexp).MatchString(previous) ||
					regexp.MustCompile(previousRegexp).MatchString(current) {
					duplicates = append(duplicates, host)
					duplicates = append(duplicates, h)
					continue
				}
			}
		}
	}
	return len(duplicates) > 0, duplicates
}
