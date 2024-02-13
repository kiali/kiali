package handlers

import (
	"net/http"
	"strings"

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

	status, err := business.TLS.NamespaceWidemTLSStatus(r.Context(), namespace, clusterNameFromQuery(r.URL.Query()))
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, status)
}

// ClustersTls is the API to get mTLS status for given namespaces within a single cluster
func ClustersTls(w http.ResponseWriter, r *http.Request) {
	params := r.URL.Query()
	namespaces := params.Get("namespaces") // csl of namespaces
	nss := []string{}
	if len(namespaces) > 0 {
		nss = strings.Split(namespaces, ",")
	}
	cluster := clusterNameFromQuery(params)

	business, err := getBusiness(r)
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if len(nss) == 0 {
		loadedNamespaces, _ := business.Namespace.GetClusterNamespaces(r.Context(), cluster)
		for _, ns := range loadedNamespaces {
			nss = append(nss, ns.Name)
		}
	}
	status, err := business.TLS.ClusterWideNSmTLSStatus(r.Context(), nss, cluster)
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, status)
}

// MeshTls is the API to get mesh-wide mTLS status
func MeshTls(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	// Get business layer
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	cluster := clusterNameFromQuery(r.URL.Query())

	// Get all the namespaces
	namespaces, err := business.Namespace.GetClusterNamespaces(ctx, cluster)
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
	globalmTLSStatus, err := business.TLS.MeshWidemTLSStatus(ctx, nsNames, cluster)
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, globalmTLSStatus)
}
