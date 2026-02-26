package mtls

import (
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
)

const (
	MTLSEnabled          = "MTLS_ENABLED"
	MTLSPartiallyEnabled = "MTLS_PARTIALLY_ENABLED"
	MTLSNotEnabled       = "MTLS_NOT_ENABLED"
	MTLSDisabled         = "MTLS_DISABLED"
)

type MtlsStatus struct {
	AllowPermissive     bool
	AutoMtlsEnabled     bool
	DestinationRules    []*networking_v1.DestinationRule
	MatchingLabels      labels.Labels
	PeerAuthentications []*security_v1.PeerAuthentication
	Services            []core_v1.Service
}

type TlsStatus struct {
	DestinationRuleStatus    string
	PeerAuthenticationStatus string
	OverallStatus            string
}

func (m MtlsStatus) hasPeerAuthnNamespacemTLSDefinition() string {
	for _, p := range m.PeerAuthentications {
		if _, mode := kubernetes.PeerAuthnHasMTLSEnabled(p); mode != "" {
			return mode
		}
	}

	return ""
}

func (m MtlsStatus) hasDesinationRuleEnablingNamespacemTLS(namespace string, conf *config.Config) string {
	for _, dr := range m.DestinationRules {
		if _, mode := kubernetes.DestinationRuleHasNamespaceWideMTLSEnabled(namespace, dr, conf); mode != "" {
			return mode
		}
	}

	return ""
}

// Returns the mTLS status at workload level (matching the m.MatchingLabels)
func (m MtlsStatus) WorkloadMtlsStatus(namespace string, conf *config.Config) string {
	for _, pa := range m.PeerAuthentications {
		var selectorLabels map[string]string
		if pa.Spec.Selector != nil {
			selectorLabels = pa.Spec.Selector.MatchLabels
		} else {
			continue
		}
		// Pre-existing bug fix: when a PA uses only MatchExpressions (no MatchLabels),
		// selectorLabels is nil. labels.Set(nil).AsSelector() produces an empty selector
		// that matches everything, causing all services to be treated as matching.
		// K8s Service selectors are simple key=value maps, so we cannot evaluate
		// MatchExpressions against them — skip PAs that have no MatchLabels.
		if len(selectorLabels) == 0 {
			continue
		}
		selector := labels.Set(selectorLabels).AsSelector()
		match := selector.Matches(m.MatchingLabels)
		if !match {
			continue
		}

		_, mode := kubernetes.PeerAuthnMTLSMode(pa)
		switch mode {
		case "STRICT":
			return MTLSEnabled
		case "DISABLE":
			return MTLSDisabled
		case "PERMISSIVE":
			if len(m.DestinationRules) == 0 {
				return MTLSNotEnabled
			} else {
				// Filter K8s Services whose selector matches the PA selector, then check DRs
				for _, svc := range m.Services {
					if svc.Namespace != namespace || len(svc.Spec.Selector) == 0 {
						continue
					}
					if selector.Matches(labels.Set(svc.Spec.Selector)) {
						filteredDrs := kubernetes.FilterDestinationRulesByService(m.DestinationRules, svc.Namespace, svc.Name, conf)
						for _, dr := range filteredDrs {
							enabled, mode := kubernetes.DestinationRuleHasMTLSEnabled(dr)
							if enabled || mode == "MUTUAL" {
								return MTLSEnabled
							} else if mode == "DISABLE" {
								return MTLSDisabled
							}
						}
					}
				}

				return MTLSNotEnabled
			}
		}
	}

	return MTLSNotEnabled
}

func (m MtlsStatus) NamespaceMtlsStatus(namespace string, conf *config.Config) TlsStatus {
	drStatus := m.hasDesinationRuleEnablingNamespacemTLS(namespace, conf)
	paStatus := m.hasPeerAuthnNamespacemTLSDefinition()
	return m.finalStatus(drStatus, paStatus)
}

func (m MtlsStatus) finalStatus(drStatus, paStatus string) TlsStatus {
	finalStatus := MTLSPartiallyEnabled

	mtlsEnabled := drStatus == "ISTIO_MUTUAL" || drStatus == "MUTUAL" || (drStatus == "" && m.AutoMtlsEnabled)
	mtlsDisabled := drStatus == "DISABLE" || (drStatus == "" && m.AutoMtlsEnabled)

	if (paStatus == "STRICT" || (paStatus == "PERMISSIVE" && m.AllowPermissive)) && mtlsEnabled {
		finalStatus = MTLSEnabled
	} else if paStatus == "DISABLE" && mtlsDisabled {
		finalStatus = MTLSDisabled
	} else if paStatus == "" && drStatus == "" {
		finalStatus = MTLSNotEnabled
	}

	return TlsStatus{
		DestinationRuleStatus:    drStatus,
		PeerAuthenticationStatus: paStatus,
		OverallStatus:            finalStatus,
	}
}

func (m MtlsStatus) MeshMtlsStatus() TlsStatus {
	drStatus := m.hasDestinationRuleMeshTLSDefinition()
	paStatus := m.hasPeerAuthnMeshTLSDefinition()
	return TlsStatus{
		DestinationRuleStatus:    drStatus,
		PeerAuthenticationStatus: paStatus,
		OverallStatus:            m.OverallMtlsStatus(TlsStatus{}, m.finalStatus(drStatus, paStatus)),
	}
}

func (m MtlsStatus) hasPeerAuthnMeshTLSDefinition() string {
	for _, mp := range m.PeerAuthentications {
		if _, mode := kubernetes.PeerAuthnHasMTLSEnabled(mp); mode != "" {
			return mode
		}
	}
	return ""
}

func (m MtlsStatus) hasDestinationRuleMeshTLSDefinition() string {
	for _, dr := range m.DestinationRules {
		if _, mode := kubernetes.DestinationRuleHasMTLSEnabledForHost("*.local", dr); mode != "" {
			return mode
		}
	}
	return ""
}

func (m MtlsStatus) OverallMtlsStatus(nsStatus, meshStatus TlsStatus) string {
	status := MTLSPartiallyEnabled
	if nsStatus.hasDefinedTls() {
		status = nsStatus.OverallStatus
	} else if nsStatus.hasPartialTlsConfig() {
		status = m.inheritedOverallStatus(nsStatus, meshStatus)
	} else if meshStatus.hasDefinedTls() {
		status = meshStatus.OverallStatus
	} else if meshStatus.hasNoConfig() {
		status = MTLSNotEnabled
	} else if meshStatus.hasPartialDisabledConfig() {
		status = MTLSDisabled
	} else if meshStatus.hasHalfTlsConfigDefined(m.AutoMtlsEnabled, m.AllowPermissive) {
		status = MTLSEnabled
	} else if !m.AutoMtlsEnabled && meshStatus.hasPartialTlsConfig() {
		status = MTLSPartiallyEnabled
	}
	return status
}

func (m MtlsStatus) inheritedOverallStatus(nsStatus, meshStatus TlsStatus) string {
	partialDRStatus, partialPAStatus := nsStatus.DestinationRuleStatus, nsStatus.PeerAuthenticationStatus
	if nsStatus.DestinationRuleStatus == "" {
		partialDRStatus = meshStatus.DestinationRuleStatus
	}

	if nsStatus.PeerAuthenticationStatus == "" {
		partialPAStatus = meshStatus.PeerAuthenticationStatus
	}

	return m.OverallMtlsStatus(TlsStatus{},
		m.finalStatus(partialDRStatus, partialPAStatus),
	)
}

func (t TlsStatus) hasDefinedTls() bool {
	return t.OverallStatus == MTLSEnabled || t.OverallStatus == MTLSDisabled
}

func (t TlsStatus) hasPartialTlsConfig() bool {
	return t.OverallStatus == MTLSPartiallyEnabled
}

func (t TlsStatus) hasHalfTlsConfigDefined(autoMtls, allowPermissive bool) bool {
	defined := false
	if autoMtls {
		defined = t.PeerAuthenticationStatus == "STRICT" && t.DestinationRuleStatus == "" ||
			(t.DestinationRuleStatus == "ISTIO_MUTUAL" || t.DestinationRuleStatus == "MUTUAL") && t.PeerAuthenticationStatus == ""

		if !defined && allowPermissive {
			defined = t.PeerAuthenticationStatus == "PERMISSIVE" && t.DestinationRuleStatus == ""
		}
	}

	return defined
}

func (t TlsStatus) hasNoConfig() bool {
	return t.PeerAuthenticationStatus == "" && t.DestinationRuleStatus == ""
}

func (t TlsStatus) hasPartialDisabledConfig() bool {
	return t.PeerAuthenticationStatus == "DISABLE" && t.DestinationRuleStatus == "" ||
		t.DestinationRuleStatus == "DISABLE" && t.PeerAuthenticationStatus == ""
}
