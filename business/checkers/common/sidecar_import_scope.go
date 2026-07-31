package common

import (
	"strings"

	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/kubernetes"
)

// ImportScope models Sidecar egress import visibility for a client namespace.
// A zero-value ImportScope is unrestricted (no Sidecar filtering), matching
// Istio's default when no effective Sidecar limits imports.
type ImportScope struct {
	identityDomain string
	namespaces     []string
	workloadNS     string
	egress         []egressEntry
	limited        bool
}

type egressEntry struct {
	DNSName   string
	Exclude   bool
	Namespace string // "." already expanded to workload namespace; "*" = any
}

// NewImportScope builds the effective Sidecar import scope for workloads in workloadNS.
// Resolution matches Istio: selector-less Sidecar in the workload namespace, else
// selector-less Sidecar in rootNS. Selector-only Sidecars are ignored (conservative).
// Empty/missing egress on the effective Sidecar means unrestricted imports.
func NewImportScope(workloadNS, rootNS string, sidecars []*networking_v1.Sidecar, namespaces []string, identityDomain string) ImportScope {
	if workloadNS == "" {
		return ImportScope{}
	}

	sc := EffectiveSidecar(workloadNS, rootNS, sidecars)
	if sc == nil {
		return ImportScope{}
	}

	entries := parseEgressEntries(sc, workloadNS)
	if len(entries) == 0 {
		// No egress listeners/hosts → Istio default is import all.
		return ImportScope{}
	}

	return ImportScope{
		limited:        true,
		workloadNS:     workloadNS,
		namespaces:     namespaces,
		identityDomain: identityDomain,
		egress:         entries,
	}
}

// EffectiveSidecar returns the selector-less Sidecar that applies namespace-wide
// to workloadNS, falling back to rootNS. Returns nil when unrestricted.
func EffectiveSidecar(workloadNS, rootNS string, sidecars []*networking_v1.Sidecar) *networking_v1.Sidecar {
	if sc := selectorLessSidecarIn(workloadNS, sidecars); sc != nil {
		return sc
	}
	if rootNS != "" && rootNS != workloadNS {
		return selectorLessSidecarIn(rootNS, sidecars)
	}
	return nil
}

func selectorLessSidecarIn(ns string, sidecars []*networking_v1.Sidecar) *networking_v1.Sidecar {
	for _, sc := range sidecars {
		if sc == nil || sc.Namespace != ns {
			continue
		}
		if sc.Spec.WorkloadSelector != nil && len(sc.Spec.WorkloadSelector.Labels) > 0 {
			continue
		}
		return sc
	}
	return nil
}

func parseEgressEntries(sc *networking_v1.Sidecar, workloadNS string) []egressEntry {
	entries := make([]egressEntry, 0)
	for _, listener := range sc.Spec.Egress {
		if listener == nil {
			continue
		}
		for _, host := range listener.Hosts {
			if e, ok := parseEgressHost(host, workloadNS); ok {
				entries = append(entries, e)
			}
		}
	}
	return entries
}

func parseEgressHost(host, workloadNS string) (egressEntry, bool) {
	parts := strings.SplitN(host, "/", 2)
	if len(parts) != 2 {
		return egressEntry{}, false
	}

	nsPart, dnsPart := parts[0], parts[1]
	exclude := false
	if strings.HasPrefix(nsPart, "~") {
		exclude = true
		nsPart = strings.TrimPrefix(nsPart, "~")
		// Istio: a bare "~" namespace is treated as wildcard "*", so "~/dnsName"
		// (and "~/*") selects/excludes across all namespaces.
		if nsPart == "" {
			nsPart = "*"
		}
	}

	switch nsPart {
	case ".":
		nsPart = workloadNS
	}

	return egressEntry{
		Namespace: nsPart,
		DNSName:   dnsPart,
		Exclude:   exclude,
	}, true
}

// IsLimited reports whether Sidecar egress filtering is active.
func (s ImportScope) IsLimited() bool {
	return s.limited
}

// ImportsHost reports whether the effective Sidecar imports the given config host.
// hostName is the raw host from VS/DR/SE.
// configNamespace is the object's namespace: used by kubernetes.GetHost for short names, and
// as the namespace association for incomplete/external hosts (ServiceEntry hosts like
// example.com) when matching against egress entries such as "ns/*".
func (s ImportScope) ImportsHost(hostName, configNamespace string) bool {
	if !s.limited {
		return true
	}
	if hostName == "" {
		return false
	}

	host := kubernetes.GetHost(hostName, configNamespace, s.namespaces, s.identityDomain)

	included := false
	for _, e := range s.egress {
		if e.Exclude {
			continue
		}
		if egressMatchesHost(e, host, hostName, configNamespace) {
			included = true
			break
		}
	}
	if !included {
		return false
	}

	for _, e := range s.egress {
		if !e.Exclude {
			continue
		}
		if egressMatchesHost(e, host, hostName, configNamespace) {
			return false
		}
	}
	return true
}

func egressMatchesHost(e egressEntry, host kubernetes.Host, rawHost, configNamespace string) bool {
	if !namespaceMatches(e.Namespace, host, configNamespace) {
		return false
	}
	return dnsMatches(e.DNSName, host, rawHost)
}

func namespaceMatches(egressNS string, host kubernetes.Host, configNamespace string) bool {
	if egressNS == "*" {
		return true
	}
	if host.CompleteInput {
		return host.Namespace == egressNS
	}
	// External / incomplete hosts (typical ServiceEntry): associate with the config's namespace.
	return configNamespace == egressNS
}

func dnsMatches(egressDNS string, host kubernetes.Host, rawHost string) bool {
	if egressDNS == "*" {
		return true
	}
	if egressDNS == rawHost {
		return true
	}
	if host.CompleteInput {
		fqdn := host.String()
		short := host.Service
		twoPart := host.Service + "." + host.Namespace
		if egressDNS == fqdn || egressDNS == short || egressDNS == twoPart {
			return true
		}
		// Egress is the pattern; config host must fall within it (Istio Sidecar matching).
		if kubernetes.HostWithinWildcardHost(fqdn, egressDNS) || kubernetes.HostWithinWildcardHost(rawHost, egressDNS) {
			return true
		}
		// Wildcard DestinationRule/VS host: include when it covers an imported egress host
		// (the config applies to that service once Sidecar imports it).
		if host.IsWildcard() && kubernetes.HostWithinWildcardHost(egressDNS, fqdn) {
			return true
		}
		return false
	}

	if egressDNS == host.Service {
		return true
	}
	return kubernetes.HostWithinWildcardHost(host.Service, egressDNS)
}

// FilterDestinationRulesByImport keeps DestinationRules whose host is imported by scope.
// When scope is unrestricted, the input slice is returned unchanged.
func FilterDestinationRulesByImport(drs []*networking_v1.DestinationRule, scope ImportScope) []*networking_v1.DestinationRule {
	if !scope.IsLimited() {
		return drs
	}
	out := make([]*networking_v1.DestinationRule, 0, len(drs))
	for _, dr := range drs {
		if dr == nil {
			continue
		}
		if scope.ImportsHost(dr.Spec.Host, dr.Namespace) {
			out = append(out, dr)
		}
	}
	return out
}

// FilterVirtualServicesByImport keeps VirtualServices that have at least one imported host.
func FilterVirtualServicesByImport(vss []*networking_v1.VirtualService, scope ImportScope) []*networking_v1.VirtualService {
	if !scope.IsLimited() {
		return vss
	}
	out := make([]*networking_v1.VirtualService, 0, len(vss))
	for _, vs := range vss {
		if vs == nil {
			continue
		}
		for _, h := range vs.Spec.Hosts {
			if scope.ImportsHost(h, vs.Namespace) {
				out = append(out, vs)
				break
			}
		}
	}
	return out
}

// FilterServiceEntriesByImport keeps ServiceEntries that have at least one imported host.
func FilterServiceEntriesByImport(ses []*networking_v1.ServiceEntry, scope ImportScope) []*networking_v1.ServiceEntry {
	if !scope.IsLimited() {
		return ses
	}
	out := make([]*networking_v1.ServiceEntry, 0, len(ses))
	for _, se := range ses {
		if se == nil {
			continue
		}
		for _, h := range se.Spec.Hosts {
			if scope.ImportsHost(h, se.Namespace) {
				out = append(out, se)
				break
			}
		}
	}
	return out
}
