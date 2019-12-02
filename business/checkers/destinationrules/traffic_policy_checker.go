package destinationrules

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type TrafficPolicyChecker struct {
	DestinationRules []kubernetes.IstioObject
	MTLSDetails      kubernetes.MTLSDetails
}

func (t TrafficPolicyChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	refdMtls := t.drsWithNonLocalmTLSEnabled()
	// When mTLS is not enabled, there is no validation to be added.
	if len(refdMtls) == 0 {
		return validations
	}

	// Check whether DRs override mTLS.
	for _, dr := range t.DestinationRules {
		drSameHosts := sameHostDestinationRules(dr, refdMtls)

		// Continue if there aren't DestinationRules enabling mTLS non-locally
		// and pointing to same host as dr.
		if len(drSameHosts) == 0 {
			continue
		}

		// Invalid if there isn't trafficPolicy specified or trafficPolicy doesn't specify TLSSettings
		if !hasTrafficPolicy(dr) || !hasTLSSettings(dr) {
			check := models.Build("destinationrules.trafficpolicy.notlssettings", "spec/trafficPolicy")
			key := models.BuildKey(DestinationRulesCheckerType, dr.GetObjectMeta().Name, dr.GetObjectMeta().Namespace)

			refKeys := make([]models.IstioValidationKey, 0, len(refdMtls))
			for _, dr := range refdMtls {
				refKeys = append(refKeys, models.BuildKey(DestinationRulesCheckerType, dr.GetObjectMeta().Name, dr.GetObjectMeta().Namespace))
			}

			validation := buildDestinationRuleValidation(dr, check, true, refKeys)

			if _, exists := validations[key]; !exists {
				validations.MergeValidations(models.IstioValidations{key: validation})
			}
		}
	}

	return validations
}

func (t TrafficPolicyChecker) drsWithNonLocalmTLSEnabled() []kubernetes.IstioObject {
	mtlsDrs := make([]kubernetes.IstioObject, 0)
	for _, dr := range t.MTLSDetails.DestinationRules {
		if host, ok := dr.GetSpec()["host"]; ok {
			if dHost, ok := host.(string); ok {
				fqdn := kubernetes.ParseHost(dHost, dr.GetObjectMeta().Namespace, dr.GetObjectMeta().ClusterName)
				if isNonLocalmTLSForServiceEnabled(dr, fqdn.Service) {
					mtlsDrs = append(mtlsDrs, dr)
				}
			}
		}
	}
	return mtlsDrs
}

func sameHostDestinationRules(dr kubernetes.IstioObject, mdrs []kubernetes.IstioObject) []kubernetes.IstioObject {
	var drHost kubernetes.Host
	shdrs := make([]kubernetes.IstioObject, 0, len(mdrs))

	if host, ok := dr.GetSpec()["host"]; ok {
		if dHost, ok := host.(string); ok {
			drHost = kubernetes.ParseHost(dHost, dr.GetObjectMeta().Namespace, dr.GetObjectMeta().ClusterName)
		}
	}

	for _, mdr := range mdrs {
		if host, ok := mdr.GetSpec()["host"]; ok {
			if dHost, ok := host.(string); ok {
				mdrHost := kubernetes.ParseHost(dHost, dr.GetObjectMeta().Namespace, dr.GetObjectMeta().ClusterName)
				if mdrHost.Service == "*.local" ||
					(mdrHost.Cluster == drHost.Cluster && mdrHost.Namespace == drHost.Namespace) {
					shdrs = append(shdrs, mdr)
				}
			}
		}
	}

	return shdrs
}

func hasTrafficPolicy(dr kubernetes.IstioObject) bool {
	_, trafficPresent := dr.GetSpec()["trafficPolicy"]
	return trafficPresent
}

func hasTLSSettings(dr kubernetes.IstioObject) bool {
	return hasTrafficPolicyTLS(dr) || hasPortTLS(dr)
}

// hasPortTLS returns true when there is one port that specifies any TLS settings
func hasPortTLS(dr kubernetes.IstioObject) bool {
	if trafficPolicy, trafficPresent := dr.GetSpec()["trafficPolicy"]; trafficPresent {
		if trafficCasted, ok := trafficPolicy.(map[string]interface{}); ok {
			if portsSettings, found := trafficCasted["portLevelSettings"]; found {
				if portsSettingsCasted, ok := portsSettings.([]interface{}); ok {
					for _, portSettings := range portsSettingsCasted {
						if portSettingsCasted, ok := portSettings.(map[string]interface{}); ok {
							if _, found := portSettingsCasted["tls"]; found {
								return true
							}
						}
					}
				}
			}
		}
	}
	return false
}

// hasTrafficPolicyTLS returns true when there is a trafficPolicy specifying any tls mode
func hasTrafficPolicyTLS(dr kubernetes.IstioObject) bool {
	if trafficPolicy, trafficPresent := dr.GetSpec()["trafficPolicy"]; trafficPresent {
		if trafficCasted, ok := trafficPolicy.(map[string]interface{}); ok {
			if _, found := trafficCasted["tls"]; found {
				return true
			}
		}
	}
	return false
}

func buildDestinationRuleValidation(dr kubernetes.IstioObject, checks models.IstioCheck, valid bool, refKeys []models.IstioValidationKey) *models.IstioValidation {
	validation := &models.IstioValidation{
		Name:       dr.GetObjectMeta().Name,
		ObjectType: DestinationRulesCheckerType,
		Valid:      valid,
		Checks: []*models.IstioCheck{
			&checks,
		},
		References: refKeys,
	}

	return validation
}
