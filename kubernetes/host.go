package kubernetes

import (
	"fmt"
	"strings"

	core_v1 "k8s.io/api/core/v1"

	"github.com/kiali/kiali/config"
)

// Host represents the FQDN format for Istio hostnames
type Host struct {
	Service       string
	Namespace     string
	Cluster       string
	CompleteInput bool
}

// ParseHost takes as an input a hostname (simple or full FQDN), namespace and clusterName and returns a parsed Host struct
func ParseHost(hostName, namespace, cluster string) Host {
	if cluster == "" {
		cluster = config.Get().ExternalServices.Istio.IstioIdentityDomain
	}

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
func GetHost(hostName, namespace, cluster string, clusterNamespaces []string) Host {
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

	return ParseHost(hostName, namespace, cluster)
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
	return fmt.Sprintf("%s.%s.%s", h.Service, h.Namespace, h.Cluster)
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

func HasMatchingWorkloads(service string, workloadList []map[string]string) bool {
	appLabel := config.Get().IstioLabels.AppLabelName

	// Check Workloads
	for _, wl := range workloadList {
		if service == wl[appLabel] {
			return true
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
