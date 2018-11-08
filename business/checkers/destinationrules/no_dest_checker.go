package destinationrules

import (
	"strconv"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type NoDestinationChecker struct {
	Namespace       string
	Services        map[string][]string
	DestinationRule kubernetes.IstioObject
}

// Check parses the DestinationRule definitions and verifies that they point to an existing service, including any subset definitions
func (n NoDestinationChecker) Check() ([]*models.IstioCheck, bool) {
	valid := true
	validations := make([]*models.IstioCheck, 0)

	if host, ok := n.DestinationRule.GetSpec()["host"]; ok {
		if dHost, ok := host.(string); ok {
			fqdn := FormatHostnameForPrefixSearch(dHost, n.DestinationRule.GetObjectMeta().Namespace, n.DestinationRule.GetObjectMeta().ClusterName)
			if versions, found := n.Services[fqdn.Service]; found {
				if hasSubsets(n.DestinationRule) {
					indexes := kubernetes.ValidateDestinationRulesSubsets([]kubernetes.IstioObject{n.DestinationRule}, fqdn.Service, versions)
					for _, i := range indexes {
						validation := models.BuildCheck("This subset is not found from the host", "error", "spec/subsets["+strconv.Itoa(i)+"]/version")
						validations = append(validations, &validation)
						valid = false
					}
				}
			} else {
				validation := models.BuildCheck("Host doesn't have a valid service", "error", "spec/host")
				validations = append(validations, &validation)
				valid = false
			}
		}
	}

	return validations, valid
}

func hasSubsets(dr kubernetes.IstioObject) bool {
	if subsets, ok := dr.GetSpec()["subsets"]; ok {
		if subsetsSI, ok := subsets.([]interface{}); ok {
			if len(subsetsSI) > 0 {
				return true
			}
		}
	}
	return false
}
