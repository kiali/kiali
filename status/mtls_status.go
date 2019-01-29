package status

import (
	"github.com/kiali/kiali/business"
)

func (si *StatusInfo) getmTLSStatus() {
	// Get business layer
	business, err := business.Get()
	if err != nil {
		Put(ClusterMTLS, "error")
		return
	}

	globalmTLSStatus, err := business.IstioConfig.MeshWidemTLSStatus()
	if err != nil {
		Put(ClusterMTLS, "error")
	}

	Put(ClusterMTLS, globalmTLSStatus)
}
