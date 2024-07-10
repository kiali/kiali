package destinationrules

import (
	"fmt"

	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type TrafficPolicyChecker struct {
	Cluster          string
	DestinationRules []*networking_v1.DestinationRule
	MTLSDetails      kubernetes.MTLSDetails
}

func (t TrafficPolicyChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	refdMtls := t.drsWithNonLocalmTLSEnabled()

	// Check whether DRs override mTLS.
	for _, dr := range t.DestinationRules {
		drSameHosts := sameHostDestinationRules(dr, refdMtls, t.DestinationRules)

		// Continue if there aren't DestinationRules enabling mTLS non-locally
		// and pointing to same host as dr.
		if len(drSameHosts) == 0 {
			continue
		}

		// Invalid if there isn't trafficPolicy specified or trafficPolicy doesn't specify TLSSettings
		if !hasTrafficPolicy(dr) || !hasTLSSettings(dr) {
			check := models.Build("destinationrules.trafficpolicy.notlssettings", "spec/trafficPolicy")
			key := models.BuildKey(DestinationRulesCheckerType, dr.Name, dr.Namespace, t.Cluster)

			refKeys := make([]models.IstioValidationKey, 0, len(refdMtls))
			for _, dr := range drSameHosts {
				refKeys = append(refKeys, models.BuildKey(DestinationRulesCheckerType, dr.Name, dr.Namespace, t.Cluster))
			}

			validation := buildDestinationRuleValidation(dr, check, true, refKeys, t.Cluster)

			if _, exists := validations[key]; !exists {
				validations.MergeValidations(models.IstioValidations{key: validation})
			}
		}
	}

	return validations
}

func (t TrafficPolicyChecker) drsWithNonLocalmTLSEnabled() []*networking_v1.DestinationRule {
	mtlsDrs := make([]*networking_v1.DestinationRule, 0)
	for _, dr := range t.MTLSDetails.DestinationRules {
		fqdn := kubernetes.ParseHost(dr.Spec.Host, dr.Namespace)
		if isNonLocalmTLSForServiceEnabled(dr, fqdn.String()) {
			mtlsDrs = append(mtlsDrs, dr)
		}
	}
	return mtlsDrs
}

func sameHostDestinationRules(dr *networking_v1.DestinationRule, mdrs []*networking_v1.DestinationRule, edrs []*networking_v1.DestinationRule) []*networking_v1.DestinationRule {
	shdrs := make([]*networking_v1.DestinationRule, 0, len(mdrs)+len(edrs))
	drHost := kubernetes.ParseHost(dr.Spec.Host, dr.Namespace)

	for _, mdr := range mdrs {
		mdrHost := kubernetes.ParseHost(mdr.Spec.Host, dr.Namespace)
		if mdrHost.Service == "*.local" ||
			(mdrHost.Cluster == drHost.Cluster && mdrHost.Namespace == drHost.Namespace) {
			shdrs = append(shdrs, mdr)
		}
	}

	for _, edr := range edrs {
		// skip the current DR
		if edr.Name == dr.Name && edr.Namespace == dr.Namespace {
			continue
		}
		dHost := edr.Spec.Host
		if ismTLSEnabled(edr) &&
			(dHost == fmt.Sprintf("*.%s.%s", drHost.Namespace, drHost.Cluster) || dHost == drHost.String()) {
			shdrs = append(shdrs, edr)
		}
	}

	return shdrs
}

func hasTrafficPolicy(dr *networking_v1.DestinationRule) bool {
	return dr.Spec.TrafficPolicy != nil
}

func hasTLSSettings(dr *networking_v1.DestinationRule) bool {
	return hasTrafficPolicyTLS(dr) || hasPortTLS(dr)
}

// hasPortTLS returns true when there is one port that specifies any TLS settings
func hasPortTLS(dr *networking_v1.DestinationRule) bool {
	if dr.Spec.TrafficPolicy != nil {
		for _, portLevel := range dr.Spec.TrafficPolicy.PortLevelSettings {
			if portLevel.Tls != nil {
				return true
			}
		}
	}
	return false
}

// hasTrafficPolicyTLS returns true when there is a trafficPolicy specifying any tls mode
func hasTrafficPolicyTLS(dr *networking_v1.DestinationRule) bool {
	if dr.Spec.TrafficPolicy != nil && dr.Spec.TrafficPolicy.Tls != nil {
		return true
	}
	return false
}

func buildDestinationRuleValidation(dr *networking_v1.DestinationRule, checks models.IstioCheck, valid bool, refKeys []models.IstioValidationKey, cluster string) *models.IstioValidation {
	validation := &models.IstioValidation{
		Cluster:    cluster,
		Name:       dr.Name,
		ObjectType: DestinationRulesCheckerType,
		Valid:      valid,
		Checks: []*models.IstioCheck{
			&checks,
		},
		References: refKeys,
	}

	return validation
}
