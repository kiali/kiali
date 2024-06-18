package handlers

import (
	"net/http"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/util/sliceutil"
)

// IstioStatus returns a list of istio components and its status
func IstioStatus(w http.ResponseWriter, r *http.Request) {
	// Get business layer
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	istioStatus, err := business.IstioStatus.GetStatus(r.Context())
	if err != nil {
		handleErrorResponse(w, err)
		return
	}

	if cluster := r.URL.Query().Get("clusterName"); cluster != "" {
		istioStatus = sliceutil.Filter(istioStatus, func(status kubernetes.ComponentStatus) bool {
			return status.Cluster == cluster
		})
	}

	RespondWithJSON(w, http.StatusOK, istioStatus)
}
