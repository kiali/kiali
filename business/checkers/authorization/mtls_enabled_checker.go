package authorization

import (
	"fmt"

	v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/business/checkers/common"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util/mtls"
)

const objectType = "authorizationpolicy"

type MtlsEnabledChecker struct {
	Namespace             string
	AuthorizationPolicies []kubernetes.IstioObject
	MtlsDetails           kubernetes.MTLSDetails
	Services              []v1.Service
	ServiceEntries        []kubernetes.IstioObject
}

// Checks if mTLS is enabled, mark all Authz Policies with error
func (c MtlsEnabledChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	for _, ap := range c.AuthorizationPolicies {
		receiveMtlsTraffic := c.IsMtlsEnabledFor(common.GetSelectorLabels(ap))
		if !receiveMtlsTraffic {
			if need, paths := needsMtls(ap); need {
				checks := make([]*models.IstioCheck, 0)
				key := models.BuildKey(objectType, ap.GetObjectMeta().Name, ap.GetObjectMeta().Namespace)

				for _, path := range paths {
					check := models.Build("authorizationpolicy.mtls.needstobeenabled", path)
					checks = append(checks, &check)
				}

				validations.MergeValidations(models.IstioValidations{key: &models.IstioValidation{
					Name:       ap.GetObjectMeta().Namespace,
					ObjectType: objectType,
					Valid:      false,
					Checks:     checks,
				}})
			}
		}
	}

	return validations
}

func needsMtls(ap kubernetes.IstioObject) (bool, []string) {
	paths := make([]string, 0)
	rules, found := ap.GetSpec()["rules"]
	if !found {
		return false, nil
	}

	cRules, ok := rules.([]interface{})
	if !ok {
		return false, nil
	}

	for i, rule := range cRules {
		cRule, ok := rule.(map[string]interface{})
		if !ok {
			continue
		}

		if froms, found := cRule["from"]; found {
			if fs, ok := froms.([]interface{}); ok {
				if needs, fPaths := fromNeedsMtls(fs, i); needs {
					paths = append(paths, fPaths...)
				}
			}
		}

		if conditions, found := cRule["when"]; found {
			if cs, ok := conditions.([]interface{}); ok {
				if needs, cPaths := conditionNeedsMtls(cs, i); needs {
					paths = append(paths, cPaths...)
				}
			}
		}
	}

	return len(paths) > 0, paths
}

func fromNeedsMtls(froms []interface{}, ruleNum int) (bool, []string) {
	paths := make([]string, 0)

	for _, from := range froms {
		cFrom, ok := from.(map[string]interface{})
		if !ok {
			continue
		}

		source, found := cFrom["source"]
		if !found {
			continue
		}

		cSource, ok := source.(map[string]interface{})
		if !ok {
			continue
		}

		for _, field := range []string{"principals", "notPrincipals", "namespaces", "notNamespaces"} {
			if hasValues(cSource, field) {
				paths = append(paths, fmt.Sprintf("spec/rules[%d]/source/%s", ruleNum, field))
			}
		}
	}
	return len(paths) > 0, paths
}

func conditionNeedsMtls(conditions []interface{}, ruleNum int) (bool, []string) {
	var keysWithMtls = [3]string{"source.namespace", "source.principal", "connection.sni"}
	paths := make([]string, 0)

	for i, c := range conditions {
		condition, ok := c.(map[string]interface{})
		if !ok {
			continue
		}

		for _, key := range keysWithMtls {
			if v, found := condition["key"]; found && v == key {
				paths = append(paths, fmt.Sprintf("spec/rules[%d]/when[%d]", ruleNum, i))
			}
		}
	}
	return len(paths) > 0, paths
}

func hasValues(definition map[string]interface{}, key string) bool {
	d, found := definition[key]
	if !found {
		return false
	}

	v, ok := d.([]interface{})
	if !ok {
		return false
	}

	return len(v) > 0
}

func (c MtlsEnabledChecker) IsMtlsEnabledFor(labels labels.Set) bool {
	mtlsEnabledNamespaceLevel := c.hasMtlsEnabledForNamespace() == mtls.MTLSEnabled
	if labels == nil {
		return mtlsEnabledNamespaceLevel
	}

	workloadmTlsStatus := mtls.MtlsStatus{
		AutoMtlsEnabled:     c.MtlsDetails.EnabledAutoMtls,
		DestinationRules:    c.MtlsDetails.DestinationRules,
		MatchingLabels:      labels,
		Namespace:           c.Namespace,
		PeerAuthentications: c.MtlsDetails.PeerAuthentications,
		Services:            c.Services,
	}.WorkloadMtlsStatus()

	if workloadmTlsStatus == mtls.MTLSEnabled {
		return true
	} else if workloadmTlsStatus == mtls.MTLSDisabled {
		return false
	} else if workloadmTlsStatus == mtls.MTLSNotEnabled {
		// need to check with ns-level and mesh-level status
		return mtlsEnabledNamespaceLevel
	}

	return false
}

func (c MtlsEnabledChecker) hasMtlsEnabledForNamespace() string {
	mtlsStatus := mtls.MtlsStatus{
		AutoMtlsEnabled: c.MtlsDetails.EnabledAutoMtls,
	}.OverallMtlsStatus(c.namespaceMtlsStatus(), c.meshWideMtlsStatus())

	// If there isn't any PeerAuthn or DestinationRule and AutoMtls is enabled,
	// then we can consider that the rule will be using mtls
	// Masthead icon won't be present in this case.
	if mtlsStatus == mtls.MTLSNotEnabled && c.MtlsDetails.EnabledAutoMtls {
		mtlsStatus = mtls.MTLSEnabled
	}

	return mtlsStatus
}

func (c MtlsEnabledChecker) meshWideMtlsStatus() mtls.TlsStatus {
	mtlsStatus := mtls.MtlsStatus{
		Namespace:           c.Namespace,
		PeerAuthentications: c.MtlsDetails.MeshPeerAuthentications,
		DestinationRules:    c.MtlsDetails.DestinationRules,
		AutoMtlsEnabled:     c.MtlsDetails.EnabledAutoMtls,
		AllowPermissive:     true,
	}

	return mtlsStatus.MeshMtlsStatus()
}

func (c MtlsEnabledChecker) namespaceMtlsStatus() mtls.TlsStatus {
	mtlsStatus := mtls.MtlsStatus{
		Namespace:           c.Namespace,
		PeerAuthentications: c.MtlsDetails.PeerAuthentications,
		DestinationRules:    c.MtlsDetails.DestinationRules,
		AutoMtlsEnabled:     c.MtlsDetails.EnabledAutoMtls,
		AllowPermissive:     true,
	}

	return mtlsStatus.NamespaceMtlsStatus()
}
