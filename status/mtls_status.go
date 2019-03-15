package status

import (
	"github.com/kiali/kiali/business"
)

func (si *StatusInfo) getmTLSStatus(token string) {
	// Get business layer
	business, err := business.Get(token)
	if err != nil {
		Put(ClusterMTLS, "error")
		return
	}

	namespaces, err := business.Namespace.GetNamespaces()
	if err != nil {
		Put(ClusterMTLS, "error")
		return
	}

	nsNames := make([]string, 0, len(namespaces))
	for _, ns := range namespaces {
		nsNames = append(nsNames, ns.Name)
	}

	globalmTLSStatus, err := business.TLS.MeshWidemTLSStatus(nsNames)
	if err != nil {
		Put(ClusterMTLS, "error")
		return
	}

	Put(ClusterMTLS, globalmTLSStatus)
}
