package status

import (
	"github.com/kiali/kiali/business"
)

const (
	GloballyEnabled    = "GLOBALLY_ENABLED"
	NotGloballyEnabled = "NOT_GLOBALLY_ENABLED"
)

func (si *StatusInfo) getmTLSStatus() {
	// Get business layer
	business, err := business.Get()
	if err != nil {
		Put(ClusterMTLS, "error")
		return
	}

	isGlobalmTLSEnabled, err := business.IstioConfig.IsMTLSGloballyEnabled()
	if err != nil {
		Put(ClusterMTLS, "error")
	}

	status := NotGloballyEnabled
	if isGlobalmTLSEnabled {
		status = GloballyEnabled
	}

	Put(ClusterMTLS, status)
}
