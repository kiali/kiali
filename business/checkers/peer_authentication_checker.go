package checkers

import (
	security_v1 "istio.io/client-go/pkg/apis/security/v1"

	"github.com/kiali/kiali/business/checkers/common"
	"github.com/kiali/kiali/business/checkers/peerauthentications"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type PeerAuthenticationChecker struct {
	Cluster               string
	Conf                  *config.Config
	IdentityDomain        string
	MTLSDetails           kubernetes.MTLSDetails
	PeerAuthentications   []*security_v1.PeerAuthentication
	RootNamespaces        map[string]string
	WorkloadsPerNamespace map[string]models.Workloads
}

// NewPeerAuthenticationChecker creates a new PeerAuthenticationChecker with all attributes.
// rootNamespaces maps each namespace to its control plane's root namespace.
func NewPeerAuthenticationChecker(
	cluster string,
	conf *config.Config,
	identityDomain string,
	rootNamespaces map[string]string,
	mtlsDetails kubernetes.MTLSDetails,
	peerAuthentications []*security_v1.PeerAuthentication,
	workloadsPerNamespace map[string]models.Workloads,
) PeerAuthenticationChecker {
	return PeerAuthenticationChecker{
		Cluster:               cluster,
		Conf:                  conf,
		IdentityDomain:        identityDomain,
		MTLSDetails:           mtlsDetails,
		PeerAuthentications:   peerAuthentications,
		RootNamespaces:        rootNamespaces,
		WorkloadsPerNamespace: workloadsPerNamespace,
	}
}

func (m PeerAuthenticationChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	validations.MergeValidations(common.PeerAuthenticationMultiMatchChecker(m.Cluster, kubernetes.PeerAuthentications, m.PeerAuthentications, m.WorkloadsPerNamespace).Check())

	for _, peerAuthn := range m.PeerAuthentications {
		validations.MergeValidations(m.runChecks(peerAuthn))
	}

	return validations
}

// runChecks runs all the individual checks for a single mesh policy and appends the result into validations.
func (m PeerAuthenticationChecker) runChecks(peerAuthn *security_v1.PeerAuthentication) models.IstioValidations {
	peerAuthnName := peerAuthn.Name
	key, rrValidation := EmptyValidValidation(peerAuthnName, peerAuthn.Namespace, kubernetes.PeerAuthentications, m.Cluster)

	var enabledCheckers []Checker

	matchLabels := make(map[string]string)
	if peerAuthn.Spec.Selector != nil {
		matchLabels = peerAuthn.Spec.Selector.MatchLabels
	}
	enabledCheckers = append(enabledCheckers, common.SelectorNoWorkloadFoundChecker(kubernetes.PeerAuthentications, matchLabels, m.WorkloadsPerNamespace))
	isRootNamespace := m.RootNamespaces[peerAuthn.Namespace] == peerAuthn.Namespace

	if isRootNamespace {
		enabledCheckers = append(enabledCheckers, peerauthentications.DisabledMeshWideChecker{PeerAuthn: peerAuthn, DestinationRules: m.MTLSDetails.DestinationRules})
	} else {
		enabledCheckers = append(enabledCheckers, peerauthentications.DisabledNamespaceWideChecker{DestinationRules: m.MTLSDetails.DestinationRules, IdentityDomain: m.IdentityDomain, PeerAuthn: peerAuthn})
	}

	// PeerAuthentications into  the root namespace namespace are considered Mesh-wide objects
	if isRootNamespace {
		enabledCheckers = append(enabledCheckers,
			peerauthentications.MeshMtlsChecker{MeshPolicy: peerAuthn, MTLSDetails: m.MTLSDetails, IsServiceMesh: false})
	} else {
		enabledCheckers = append(enabledCheckers,
			peerauthentications.NamespaceMtlsChecker{IdentityDomain: m.IdentityDomain, MTLSDetails: m.MTLSDetails, PeerAuthn: peerAuthn})
	}

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		rrValidation.Checks = append(rrValidation.Checks, checks...)
		rrValidation.Valid = rrValidation.Valid && validChecker
	}

	return models.IstioValidations{key: rrValidation}
}
