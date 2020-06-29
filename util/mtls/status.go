package mtls

import (
	"github.com/kiali/kiali/kubernetes"
)

const (
	MTLSEnabled          = "MTLS_ENABLED"
	MTLSPartiallyEnabled = "MTLS_PARTIALLY_ENABLED"
	MTLSNotEnabled       = "MTLS_NOT_ENABLED"
	MTLSDisabled         = "MTLS_DISABLED"
)

type MtlsStatus struct {
	Namespace           string
	PeerAuthentications []kubernetes.IstioObject
	DestinationRules    []kubernetes.IstioObject
	AutoMtlsEnabled     bool
	AllowPermissive     bool
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

func (m MtlsStatus) hasDesinationRuleEnablingNamespacemTLS() string {
	for _, dr := range m.DestinationRules {
		if _, mode := kubernetes.DestinationRuleHasNamespaceWideMTLSEnabled(m.Namespace, dr); mode != "" {
			return mode
		}
	}

	return ""
}

func (m MtlsStatus) NamespaceMtlsStatus() TlsStatus {
	drStatus := m.hasDesinationRuleEnablingNamespacemTLS()
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
	return m.finalStatus(drStatus, paStatus)
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
	var status string
	if nsStatus.hasDefiniteTls() {
		status = nsStatus.OverallStatus
	} else if nsStatus.hasPartialTlsConfig() {
		status = m.inheritedOverallStatus(nsStatus, meshStatus)
	} else if meshStatus.hasDefiniteTls() {
		status = meshStatus.OverallStatus
	} else if m.AutoMtlsEnabled {
		status = MTLSEnabled
		if meshStatus.PeerAuthenticationStatus == "DISABLE" || meshStatus.DestinationRuleStatus == "DISABLE" {
			status = MTLSDisabled
		}
	} else {
		status = MTLSNotEnabled
	}
	return status
}

func (m MtlsStatus) inheritedOverallStatus(nsStatus, meshStatus TlsStatus) string {
	var partialDRStatus, partialPAStatus = nsStatus.DestinationRuleStatus, nsStatus.PeerAuthenticationStatus
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

func (t TlsStatus) hasDefiniteTls() bool {
	return t.OverallStatus == MTLSEnabled || t.OverallStatus == MTLSDisabled
}

func (t TlsStatus) hasPartialTlsConfig() bool {
	return t.OverallStatus == MTLSPartiallyEnabled
}
