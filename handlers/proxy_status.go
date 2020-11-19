package handlers

import (
	"net/http"

	"github.com/gorilla/mux"
)

func ConfigDump(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	// Get business layer
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	namespace := params["namespace"]
	pod := params["pod"]

	dump, err := business.ProxyStatus.GetConfigDump(namespace, pod)
	if err != nil {
		handleErrorResponse(w, err)
		return
	}

	RespondWithJSON(w, http.StatusOK, dump)
}

func ConfigDumpResourceEntries(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	// Get business layer
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	namespace := params["namespace"]
	pod := params["pod"]
	resource := params["resource"]

	dump, err := business.ProxyStatus.GetConfigDumpResourceEntries(namespace, pod, resource)
	if err != nil {
		handleErrorResponse(w, err)
		return
	}

	RespondWithJSON(w, http.StatusOK, dump)
}
