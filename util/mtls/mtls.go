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

func (m MtlsStatus) NamespaceMtlsStatus() string {
	drStatus := m.hasDesinationRuleEnablingNamespacemTLS()
	paStatus := m.hasPeerAuthnNamespacemTLSDefinition()
	return m.finalStatus(drStatus, paStatus)
}

func (m MtlsStatus) finalStatus(drStatus, paStatus string) string {
	finalStatus := MTLSPartiallyEnabled

	mtlsEnabled := drStatus == "ISTIO_MUTUAL" || drStatus == "MUTUAL" || (drStatus == "" && m.AutoMtlsEnabled)
	mtlsDisabled := drStatus == "DISABLE" || (drStatus == "" && m.AutoMtlsEnabled)

	if paStatus == "STRICT" && mtlsEnabled {
		finalStatus = MTLSEnabled
	} else if paStatus == "DISABLE" && mtlsDisabled {
		finalStatus = MTLSDisabled
	} else if paStatus == "" {
		if drStatus == "DISABLE" {
			finalStatus = MTLSDisabled
		} else if m.AutoMtlsEnabled && drStatus == "ISTIO_MUTUAL" || drStatus == "MUTUAL" {
			finalStatus = MTLSEnabled
		} else if drStatus == "" {
			finalStatus = MTLSNotEnabled
		}
	}

	return finalStatus
}

func (m MtlsStatus) MeshMtlsStatus() string {
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

func OverallMtlsStatus(nsStatus, meshStatus string, autoMtlsEnabled bool) string {
	var status string
	if nsStatus == MTLSEnabled || nsStatus == MTLSDisabled {
		status = nsStatus
	} else if meshStatus == MTLSEnabled || meshStatus == MTLSDisabled {
		status = meshStatus
	} else if autoMtlsEnabled {
		status = MTLSEnabled
	} else {
		status = MTLSNotEnabled
	}
	return status
}
