package handlers

import (
	"net/http"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/config"
)

func ConfigDump(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	cluster := clusterNameFromQuery(config.Get(), r.URL.Query())
	namespace := params["namespace"]
	pod := params["pod"]

	dump, err := business.ProxyStatus.GetConfigDump(cluster, namespace, pod)
	if err != nil {
		handleErrorResponse(w, err)
		return
	}

	RespondWithJSON(w, http.StatusOK, dump)
}

func ConfigDumpResourceEntries(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	cluster := clusterNameFromQuery(config.Get(), r.URL.Query())
	namespace := params["namespace"]
	pod := params["pod"]
	resource := params["resource"]

	dump, err := business.ProxyStatus.GetConfigDumpResourceEntries(cluster, namespace, pod, resource)
	if err != nil {
		handleErrorResponse(w, err)
		return
	}

	RespondWithJSON(w, http.StatusOK, dump)
}
