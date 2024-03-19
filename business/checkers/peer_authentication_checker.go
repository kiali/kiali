package checkers

import (
	security_v1beta "istio.io/client-go/pkg/apis/security/v1beta1"

	"github.com/kiali/kiali/business/checkers/common"
	"github.com/kiali/kiali/business/checkers/peerauthentications"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

const PeerAuthenticationCheckerType = "peerauthentication"

type PeerAuthenticationChecker struct {
	PeerAuthentications   []*security_v1beta.PeerAuthentication
	MTLSDetails           kubernetes.MTLSDetails
	WorkloadsPerNamespace map[string]models.WorkloadList
	Cluster               string
}

func (m PeerAuthenticationChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	validations.MergeValidations(common.PeerAuthenticationMultiMatchChecker(m.Cluster, PeerAuthenticationCheckerType, m.PeerAuthentications, m.WorkloadsPerNamespace).Check())

	for _, peerAuthn := range m.PeerAuthentications {
		validations.MergeValidations(m.runChecks(peerAuthn))
	}

	return validations
}

// runChecks runs all the individual checks for a single mesh policy and appends the result into validations.
func (m PeerAuthenticationChecker) runChecks(peerAuthn *security_v1beta.PeerAuthentication) models.IstioValidations {
	peerAuthnName := peerAuthn.Name
	key, rrValidation := EmptyValidValidation(peerAuthnName, peerAuthn.Namespace, PeerAuthenticationCheckerType, m.Cluster)

	var enabledCheckers []Checker

	matchLabels := make(map[string]string)
	if peerAuthn.Spec.Selector != nil {
		matchLabels = peerAuthn.Spec.Selector.MatchLabels
	}
	enabledCheckers = append(enabledCheckers, common.SelectorNoWorkloadFoundChecker(PeerAuthenticationCheckerType, matchLabels, m.WorkloadsPerNamespace))
	if config.IsRootNamespace(peerAuthn.Namespace) {
		enabledCheckers = append(enabledCheckers, peerauthentications.DisabledMeshWideChecker{PeerAuthn: peerAuthn, DestinationRules: m.MTLSDetails.DestinationRules})
	} else {
		enabledCheckers = append(enabledCheckers, peerauthentications.DisabledNamespaceWideChecker{PeerAuthn: peerAuthn, DestinationRules: m.MTLSDetails.DestinationRules})
	}

	// PeerAuthentications into  the root namespace namespace are considered Mesh-wide objects
	if config.IsRootNamespace(peerAuthn.Namespace) {
		enabledCheckers = append(enabledCheckers,
			peerauthentications.MeshMtlsChecker{MeshPolicy: peerAuthn, MTLSDetails: m.MTLSDetails, IsServiceMesh: false})
	} else {
		enabledCheckers = append(enabledCheckers,
			peerauthentications.NamespaceMtlsChecker{PeerAuthn: peerAuthn, MTLSDetails: m.MTLSDetails})
	}

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		rrValidation.Checks = append(rrValidation.Checks, checks...)
		rrValidation.Valid = rrValidation.Valid && validChecker
	}

	iv := make(models.IstioValidations)
	iv[key] = rrValidation
	return iv
}
