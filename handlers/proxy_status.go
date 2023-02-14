package handlers

import (
	"net/http"

	"github.com/gorilla/mux"
	"k8s.io/client-go/tools/clientcmd/api"

	kiali_business "github.com/kiali/kiali/business"
	"github.com/kiali/kiali/kubernetes"
)

func ConfigDump(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	// Get business layer
	kialiToken, err := kubernetes.GetKialiToken()
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error (kiali token): "+err.Error())
	}

	business, err := kiali_business.Get(&api.AuthInfo{Token: kialiToken})
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
	kialiToken, err := kubernetes.GetKialiToken()
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error (kiali token): "+err.Error())
	}

	business, err := kiali_business.Get(&api.AuthInfo{Token: kialiToken})
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
