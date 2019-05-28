package handlers

import (
	"net/http"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/log"
)

// NamespaceTls is the API to get namespace-wide mTLS status
func NamespaceTls(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	// Get business layer
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	namespace := params["namespace"]

	status, err := business.TLS.NamespaceWidemTLSStatus(namespace)
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, status)
}

// MeshTls is the API to get mesh-wide mTLS status
func MeshTls(w http.ResponseWriter, r *http.Request) {
	// Get business layer
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	// Get all the namespaces
	namespaces, err := business.Namespace.GetNamespaces()
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Get all namespace names
	nsNames := make([]string, 0, len(namespaces))
	for _, ns := range namespaces {
		nsNames = append(nsNames, ns.Name)
	}

	// Get mtls status given the whole namespaces
	globalmTLSStatus, err := business.TLS.MeshWidemTLSStatus(nsNames)
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, globalmTLSStatus)
}
