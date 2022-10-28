package handlers

import "net/http"

// GetClusters writes to the HTTP response a JSON document with the
// list of clusters that are part of the mesh when multi-cluster is enabled. If
// multi-cluster is not enabled in the control plane, this handler may provide
// erroneous data.
func GetClusters(w http.ResponseWriter, r *http.Request) {
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Business layer initialization error: "+err.Error())
		return
	}

	meshClusters, err := business.Mesh.GetClusters(r)
	if err != nil {
		RespondWithError(w, http.StatusServiceUnavailable, "Cannot fetch mesh clusters: "+err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, meshClusters)
}

func OutboundTrafficPolicyMode(w http.ResponseWriter, r *http.Request) {
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	otp, _ := business.Mesh.OutboundTrafficPolicy()
	RespondWithJSON(w, http.StatusOK, otp)
}

func IstiodResourceThresholds(w http.ResponseWriter, r *http.Request) {
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	irt, _ := business.Mesh.IstiodResourceThresholds()
	RespondWithJSON(w, http.StatusOK, irt)
}

func IstiodCanariesStatus(w http.ResponseWriter, r *http.Request) {
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	irt, _ := business.Mesh.CanaryUpgradeStatus()
	RespondWithJSON(w, http.StatusOK, irt)
}
