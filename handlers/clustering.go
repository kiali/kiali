package handlers

import "net/http"

// GetMeshClusters ...
func GetMeshClusters(w http.ResponseWriter, r *http.Request) {
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Business layer initialization error: " + err.Error())
		return
	}

	meshClusters, err := business.Clustering.GetMeshClusters()
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Cannot fetch mesh clusters: " + err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, meshClusters)
}