package sidecars

import (
	"fmt"
	"strings"

	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
)

type EgressHostChecker struct {
	Sidecar          *networking_v1beta1.Sidecar
	ServiceEntries   map[string][]string
	RegistryServices []*kubernetes.RegistryService
}

type HostWithIndex struct {
	Index int
	Hosts []string
}

func (elc EgressHostChecker) Check() ([]*models.IstioCheck, bool) {
	checks, valid := make([]*models.IstioCheck, 0), true
	hosts, ok := elc.getHosts()
	if !ok {
		return checks, valid
	}

	for i, hwi := range hosts {
		for j, h := range hwi.Hosts {
			check, hv := elc.validateHost(h, i, j)
			checks = append(checks, check...)
			valid = valid && hv
		}
	}

	return checks, valid
}

func (elc EgressHostChecker) getHosts() ([]HostWithIndex, bool) {
	if len(elc.Sidecar.Spec.Egress) == 0 {
		return nil, false
	}
	hl := make([]HostWithIndex, 0, len(elc.Sidecar.Spec.Egress))
	for i, ei := range elc.Sidecar.Spec.Egress {
		if ei == nil {
			continue
		}
		hwi := HostWithIndex{
			Index: i,
			Hosts: ei.Hosts,
		}
		hl = append(hl, hwi)
	}
	return hl, true
}

func (elc EgressHostChecker) validateHost(host string, egrIdx, hostIdx int) ([]*models.IstioCheck, bool) {
	checks := make([]*models.IstioCheck, 0)
	sns := elc.Sidecar.Namespace

	hostNs, dnsName := getHostComponents(host)

	// Don't show any validation for common scenarios like */*, ~/* and ./*
	if (hostNs == "*" || hostNs == "~" || hostNs == ".") && dnsName == "*" {
		return checks, true
	}

	// namespace/* is a valid scenario
	if dnsName == "*" {
		return checks, true
	}

	fqdn := kubernetes.ParseHost(dnsName, sns)

	// Lookup for matching services
	if !elc.HasMatchingService(fqdn, sns) {
		checks = append(checks, buildCheck("sidecar.egress.servicenotfound", egrIdx, hostIdx))
	}

	return checks, true
}

func (elc EgressHostChecker) HasMatchingService(host kubernetes.Host, itemNamespace string) bool {
	// Check wildcard hosts - needs to match "*" and "*.suffix" also.
	if host.IsWildcard() && host.Namespace == itemNamespace {
		return true
	}
	if kubernetes.HasMatchingServiceEntries(host.String(), elc.ServiceEntries) {
		return true
	}
	return kubernetes.HasMatchingRegistryService(itemNamespace, host.String(), elc.RegistryServices)
}

func getHostComponents(host string) (string, string) {
	hParts := strings.Split(host, "/")
	if len(hParts) < 2 {
		// This should not happen because config CRD will prevent creating wrong hosts
		log.Errorf("host %s does not match namespace/dnsName format", host)
		return "", ""
	}
	return hParts[0], hParts[1]
}

func buildCheck(code string, egrIdx, hostIdx int) *models.IstioCheck {
	check := models.Build(code, fmt.Sprintf("spec/egress[%d]/hosts[%d]", egrIdx, hostIdx))
	return &check
}
