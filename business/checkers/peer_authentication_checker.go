package checkers

import (
	"github.com/kiali/kiali/business/checkers/common"
	"github.com/kiali/kiali/business/checkers/peerauthentications"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

const PeerAuthenticationCheckerType = "peerauthentication"

type PeerAuthenticationChecker struct {
	PeerAuthentications []kubernetes.IstioObject
	MTLSDetails         kubernetes.MTLSDetails
	WorkloadList        models.WorkloadList
}

func (m PeerAuthenticationChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	validations.MergeValidations(common.SelectorMultiMatchChecker(PeerAuthenticationCheckerType, m.PeerAuthentications, m.WorkloadList).Check())

	for _, peerAuthn := range m.PeerAuthentications {
		validations.MergeValidations(m.runChecks(peerAuthn))
	}

	return validations
}

// runChecks runs all the individual checks for a single mesh policy and appends the result into validations.
func (m PeerAuthenticationChecker) runChecks(peerAuthn kubernetes.IstioObject) models.IstioValidations {
	peerAuthnName := peerAuthn.GetObjectMeta().Name
	key, rrValidation := EmptyValidValidation(peerAuthnName, peerAuthn.GetObjectMeta().Namespace, PeerAuthenticationCheckerType)

	var enabledCheckers []Checker

	enabledCheckers = append(enabledCheckers, common.SelectorNoWorkloadFoundChecker(PeerAuthenticationCheckerType, peerAuthn, m.WorkloadList))

	// MeshWide and NamespaceWide validations are only needed with autoMtls disabled
	if !m.MTLSDetails.EnabledAutoMtls {
		// PeerAuthentications into istio control plane namespace are considered Mesh-wide objects
		if peerAuthn.GetObjectMeta().Namespace == config.Get().IstioNamespace {
			enabledCheckers = append(enabledCheckers,
				peerauthentications.MeshMtlsChecker{MeshPolicy: peerAuthn, MTLSDetails: m.MTLSDetails, IsServiceMesh: false})
		} else {
			enabledCheckers = append(enabledCheckers,
				peerauthentications.NamespaceMtlsChecker{PeerAuthn: peerAuthn, MTLSDetails: m.MTLSDetails})
		}
	}

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		rrValidation.Checks = append(rrValidation.Checks, checks...)
		rrValidation.Valid = rrValidation.Valid && validChecker
	}

	return models.IstioValidations{key: rrValidation}
}
