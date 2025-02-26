package kubernetes

import (
	"fmt"
	"strings"

	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"
	k8s_networking_v1beta1 "sigs.k8s.io/gateway-api/apis/v1beta1"

	"github.com/kiali/kiali/config"
)

// Host represents the FQDN format for Istio hostnames
type Host struct {
	Service   string `json:"service"`
	Namespace string `json:"namespace"`
	Cluster   string `json:"cluster"`
	// CompleteInput is true when Service, Namespace and Cluster fields are present.
	// It is true for simple service names and FQDN services.
	// It is false for service.namespace format and service entries.
	CompleteInput bool `json:"complete_input"`
}

// ParseHost takes as an input a hostname (simple or full FQDN), namespace and clusterName and returns a parsed Host struct
func ParseHost(hostName, namespace string) Host {
	cluster := config.Get().ExternalServices.Istio.IstioIdentityDomain

	domainParts := strings.Split(hostName, ".")
	host := Host{
		Service: domainParts[0],
	}
	if len(domainParts) > 1 {
		if len(domainParts) > 2 {
			parsedClusterName := strings.Join(domainParts[2:], ".")
			if parsedClusterName == cluster {
				// FQDN input
				host.Cluster = cluster
				host.CompleteInput = true
			}
		}

		if host.CompleteInput {
			host.Namespace = domainParts[1]
		} else {
			// ServiceEntry or broken hostname
			host.Service = hostName
		}
	} else {
		// Simple format
		host.Namespace = namespace
		host.Cluster = cluster
		host.CompleteInput = true
	}

	return host
}

// GetHost parses hostName and returns a Host struct. It considers Namespaces in the cluster to be more accurate
// when deciding if the hostName is a ServiceEntry or a service.namespace host definition.
func GetHost(hostName, namespace string, clusterNamespaces []string) Host {
	cluster := config.Get().ExternalServices.Istio.IstioIdentityDomain

	hParts := strings.Split(hostName, ".")
	// It might be a service entry or a 2-format host specification
	if len(hParts) == 2 {
		// It is subject of validation when object is within the namespace
		// Otherwise is considered as a service entry
		if hParts[1] == namespace || includes(clusterNamespaces, hParts[1]) {
			return Host{
				Service:       hParts[0],
				Namespace:     hParts[1],
				Cluster:       cluster,
				CompleteInput: true,
			}
		}
	}

	// Case where it's a short name with the format <service>.<namespace>.svc
	if len(hParts) == 3 && hParts[2] == "svc" {
		return Host{
			Service:       hParts[0],
			Namespace:     hParts[1],
			Cluster:       cluster,
			CompleteInput: true,
		}
	}

	return ParseHost(hostName, namespace)
}

func includes(nss []string, namespace string) bool {
	for _, ns := range nss {
		if ns == namespace {
			return true
		}
	}
	return false
}

// String outputs a full FQDN version of the Host
func (h Host) String() string {
	var hostname string
	if h.CompleteInput {
		if h.Cluster != "" {
			hostname = fmt.Sprintf("%s.%s.%s", h.Service, h.Namespace, h.Cluster)
		} else {
			hostname = fmt.Sprintf("%s.%s", h.Service, h.Namespace)
		}
	} else {
		hostname = h.Service
	}
	return hostname
}

func (h Host) IsWildcard() bool {
	return strings.HasPrefix(h.Service, "*")
}

func ParseTwoPartHost(host Host) (string, string) {
	localSvc, localNs := host.Service, host.Namespace
	if !host.CompleteInput {
		svcParts := strings.Split(host.Service, ".")
		if len(svcParts) > 1 {
			localSvc = svcParts[0]
			localNs = svcParts[1]
		}
	}
	return localSvc, localNs
}

func HasMatchingWorkloads(service string, workloadList []labels.Set) bool {
	// Check Workloads
	for _, wl := range workloadList {
		if appLabelName, found := config.Get().GetAppLabelName(wl); found {
			if service == wl.Get(appLabelName) {
				return true
			}
		}
	}

	return false
}

func HasMatchingServices(service string, services []core_v1.Service) bool {
	for _, s := range services {
		if service == s.Name {
			return true
		}
	}
	return false
}

func HasMatchingServiceEntries(service string, serviceEntries map[string][]string) bool {
	for k := range serviceEntries {
		hostKey := k
		if i := strings.Index(k, "*"); i > -1 {
			hostKey = k[i+1:]
		}
		if strings.HasSuffix(service, hostKey) {
			return true
		}
	}

	if _, found := serviceEntries[service]; found {
		return true
	}

	return false
}

func HasMatchingVirtualServices(host Host, virtualServices []*networking_v1.VirtualService) bool {
	vHostTwoParts := fmt.Sprintf("%s.%s", host.Service, host.Namespace)
	vHostFqdnNoWild := fmt.Sprintf("%s.%s.%s", host.Service, host.Namespace, config.Get().ExternalServices.Istio.IstioIdentityDomain)
	vHostFqdnWild := fmt.Sprintf("*.%s.%s", host.Namespace, config.Get().ExternalServices.Istio.IstioIdentityDomain)
	for _, vs := range virtualServices {
		for hostIdx := 0; hostIdx < len(vs.Spec.Hosts); hostIdx++ {
			vHost := vs.Spec.Hosts[hostIdx]

			// vHost is wildcard, then any host fit in
			if vHost == "*" {
				return true
			}

			// vHost is simple name (namespaces should match)
			if vHost == host.Service && vs.Namespace == host.Namespace {
				return true
			}

			// vHost twoparts name
			if vHost == vHostTwoParts {
				return true
			}

			// vHost FQDN (no-wildcarded)
			if vHost == vHostFqdnNoWild {
				return true
			}

			// vHost if wildcard FQDN
			if vHost == vHostFqdnWild {
				return true
			}

			// Non-internal service name
			hostS := ParseHost(vHost, vs.Namespace)
			if hostS.Service == host.Service && hostS.CompleteInput == host.CompleteInput && !hostS.CompleteInput {
				return true
			}

			// Non-internal wildcard service name
			if HostWithinWildcardHost(host.Service, vHost) {
				return true
			}
		}
	}

	return false
}

// HasMatchingRegistryService returns true when the FDQN of the host (from given namespace) param matches
// with one registry service of the registryServices param.
func HasMatchingRegistryService(namespace string, host string, registryServices []*RegistryService) bool {
	for _, rStatus := range registryServices {
		// We assume that on these cases the host.Service is provided in FQDN
		// i.e. ratings.mesh2-bookinfo.svc.mesh1-imports.local
		if FilterByRegistryService(namespace, host, rStatus) {
			return true
		}
	}
	return false
}

// HasMatchingReferenceGrant returns true when the From matches to given fromNamespace and fromKind and To matched given toNamespace and toKind.
func HasMatchingReferenceGrant(fromNamespace string, toNamespace string, fromKind string, toKind string, referenceGrants []*k8s_networking_v1beta1.ReferenceGrant) bool {
	for _, rGrant := range referenceGrants {
		if len(rGrant.Spec.From) > 0 && len(rGrant.Spec.To) > 0 &&
			string(rGrant.Spec.From[0].Namespace) == fromNamespace &&
			rGrant.Namespace == toNamespace &&
			string(rGrant.Spec.From[0].Kind) == fromKind &&
			string(rGrant.Spec.To[0].Kind) == toKind {
			return true
		}
	}
	return false
}

func HostWithinWildcardHost(subdomain, wildcardDomain string) bool {
	if !strings.HasPrefix(wildcardDomain, "*") {
		return false
	}

	return len(wildcardDomain) > 2 && strings.HasSuffix(subdomain, wildcardDomain[2:])
}

func ParseGatewayAsHost(gateway, currentNamespace string) Host {
	currentCluster := config.Get().ExternalServices.Istio.IstioIdentityDomain

	host := Host{
		Service:       gateway,
		Namespace:     currentNamespace,
		Cluster:       currentCluster,
		CompleteInput: true,
	}

	if strings.Contains(gateway, ".") {
		parts := strings.Split(gateway, ".")
		host.Service = parts[0]

		if len(parts) > 1 {
			host.Namespace = parts[1]

			if len(parts) > 2 {
				host.Cluster = strings.Join(parts[2:], ".")
			}
		}
	} else if strings.Contains(gateway, "/") {
		parts := strings.Split(gateway, "/")
		host.Namespace = parts[0]
		host.Service = parts[1]
	}

	return host
}
