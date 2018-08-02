package handlers

import (
	"github.com/gorilla/mux"
	"github.com/kiali/kiali/services/business"
	"net/http"
)

func DeploymentList(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	// Get business layer
	business, err := business.Get()
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}
	namespace := params["namespace"]

	// Fetch and build deployments
	serviceList, err := business.DeploymentService.GetDeploymentList(namespace)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, serviceList)
}
