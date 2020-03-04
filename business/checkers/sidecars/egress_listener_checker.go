package sidecars

import (
	"fmt"
	"strings"

	core_v1 "k8s.io/api/core/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type EgressHostChecker struct {
	Sidecar        kubernetes.IstioObject
	ServiceEntries map[string][]string
	Services       []core_v1.Service
}

type HostWithIndex struct {
	Index int
	Hosts []interface{}
}

func (elc EgressHostChecker) Check() ([]*models.IstioCheck, bool) {
	checks, valid := make([]*models.IstioCheck, 0), true
	hosts, ok := elc.getHosts()
	if !ok {
		return checks, valid
	}

	for i, hwi := range hosts {
		for j, h := range hwi.Hosts {
			host, ok := h.(string)
			if !ok {
				continue
			}

			check, hv := elc.validateHost(host, i, j)
			checks = append(checks, check...)
			valid = valid && hv
		}
	}

	return checks, valid
}

func (elc EgressHostChecker) getHosts() ([]HostWithIndex, bool) {
	er, found := elc.Sidecar.GetSpec()["egress"]
	if !found {
		return nil, found
	}

	el, ok := er.([]interface{})
	if !ok {
		return nil, found
	}

	hl := make([]HostWithIndex, 0, len(el))
	for i, ei := range el {
		ec, ok := ei.(map[string]interface{})
		if !ok {
			return nil, ok
		}

		hr, found := ec["hosts"]
		if !found {
			return nil, ok
		}

		hc, ok := hr.([]interface{})
		if !ok {
			return nil, ok
		}

		hwi := HostWithIndex{
			Index: i,
			Hosts: hc,
		}

		hl = append(hl, hwi)
	}

	return hl, true
}

func (elc EgressHostChecker) validateHost(host string, egrIdx, hostIdx int) ([]*models.IstioCheck, bool) {
	checks := make([]*models.IstioCheck, 0)
	ins := config.Get().IstioNamespace
	sns := elc.Sidecar.GetObjectMeta().Namespace

	hostNs, dnsName, valid := getHostComponents(host)
	if !valid {
		return append(checks, buildCheck("sidecar.egress.invalidhostformat", egrIdx, hostIdx)), false
	}

	// Don't show any validation for common scenarios like */*, ~/* and ./*
	if (hostNs == "*" || hostNs == "~" || hostNs == ".") && dnsName == "*" {
		return checks, true
	}

	// Show cross-namespace validation
	// when namespace is different to both istio control plane or sidecar namespace
	if hostNs != ins && hostNs != sns && hostNs != "." {
		return append(checks, buildCheck("validation.unable.cross-namespace", egrIdx, hostIdx)), true
	}

	// Lookup services when ns is . or sidecar namespace
	if hostNs == sns || hostNs == "." {
		// namespace/* is a valid scenario
		if dnsName == "*" {
			return checks, true
		}

		// Parse the dnsName to a kubernetes Host
		fqdn := kubernetes.ParseHost(dnsName, sns, elc.Sidecar.GetObjectMeta().ClusterName)
		if fqdn.Namespace != sns && fqdn.Namespace != "" {
			return append(checks, buildCheck("validation.unable.cross-namespace", egrIdx, hostIdx)), true
		}

		// Lookup for matching services
		if !elc.HasMatchingService(fqdn, sns) {
			checks = append(checks, buildCheck("sidecar.egress.servicenotfound", egrIdx, hostIdx))
		}
	}

	return checks, true
}

func (elc EgressHostChecker) HasMatchingService(host kubernetes.Host, itemNamespace string) bool {
	if strings.HasPrefix(host.Service, "*") {
		return true
	}

	if kubernetes.HasMatchingServices(host.Service, elc.Services) {
		return true
	}

	return kubernetes.HasMatchingServiceEntries(host.Service, elc.ServiceEntries)
}

func getHostComponents(host string) (string, string, bool) {
	hParts := strings.Split(host, "/")

	if len(hParts) != 2 {
		return "", "", false
	}

	return hParts[0], hParts[1], true
}

func buildCheck(code string, egrIdx, hostIdx int) *models.IstioCheck {
	check := models.Build(code, fmt.Sprintf("spec/egress[%d]/hosts[%d]", egrIdx, hostIdx))
	return &check
}
