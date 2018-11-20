package gateways

import (
	"regexp"
	"strconv"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type MultiMatchChecker struct {
	GatewaysPerNamespace [][]kubernetes.IstioObject
	existingList         []Host
}

const (
	GatewayCheckerType = "gateway"
	wildCardMatch      = "*"
)

type Host struct {
	Port     uint32
	Hostname string
	Index    int
}

// Check validates that no two gateways share the same host+port combination
func (m MultiMatchChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}
	m.existingList = make([]Host, 0)

	for _, nsG := range m.GatewaysPerNamespace {
		for _, g := range nsG {
			gatewayRuleName := g.GetObjectMeta().Name
			if specServers, found := g.GetSpec()["servers"]; found {
				if servers, ok := specServers.([]interface{}); ok {
					for i, def := range servers {
						if serverDef, ok := def.(map[string]interface{}); ok {
							hosts := parsePortAndHostnames(serverDef)
							for _, host := range hosts {
								duplicate := m.findMatch(host)
								if !duplicate {
									m.existingList = append(m.existingList, host)
								} else {
									validations = addError(validations, gatewayRuleName, i)
								}
							}
						}
					}
				}
			}
		}
	}
	return validations
}

func addError(validations models.IstioValidations, gatewayRuleName string, index int) models.IstioValidations {
	key := models.IstioValidationKey{Name: gatewayRuleName, ObjectType: GatewayCheckerType}
	checks := models.BuildCheck("More than one Gateway for same host port combination",
		"warning", "spec/servers["+strconv.Itoa(index)+"]")
	rrValidation := &models.IstioValidation{
		Name:       gatewayRuleName,
		ObjectType: GatewayCheckerType,
		Valid:      false,
		Checks: []*models.IstioCheck{
			&checks,
		},
	}

	if _, exists := validations[key]; !exists {
		validations.MergeValidations(models.IstioValidations{key: rrValidation})
	}
	return validations
}

func parsePortAndHostnames(serverDef map[string]interface{}) []Host {
	var port uint32
	if portDef, found := serverDef["port"]; found {
		if ports, ok := portDef.(map[string]interface{}); ok {
			if numberDef, found := ports["number"]; found {
				if portNumber, ok := numberDef.(uint32); ok {
					port = portNumber
				}
			}
		}
	}

	if hostDef, found := serverDef["hosts"]; found {
		if hostnames, ok := hostDef.([]interface{}); ok {
			hosts := make([]Host, 0, len(hostnames))
			for _, hostinterface := range hostnames {
				if hostname, ok := hostinterface.(string); ok {
					hosts = append(hosts, Host{
						Port:     port,
						Hostname: hostname,
					})
				}
			}
			return hosts
		}
	}
	return nil
}

// findMatch uses a linear search with regexp to check for matching gateway host + port combinations. If this becomes a bottleneck for performance, replace with a graph or trie algorithm.
func (m MultiMatchChecker) findMatch(host Host) bool {
	for _, h := range m.existingList {
		if h.Port == host.Port {
			// wildcardMatches will always match
			if host.Hostname == wildCardMatch || h.Hostname == wildCardMatch {
				return true
			}
			// Either one could include wildcards, so we need to check both ways
			if regexp.MustCompile(host.Hostname).MatchString(h.Hostname) {
				return true
			}
			if regexp.MustCompile(h.Hostname).MatchString(host.Hostname) {
				return true
			}
		}
	}
	return false
}
