package handlers

import (
	"net/http"
	"strings"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util/sliceutil"
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

	status, err := business.TLS.NamespaceWidemTLSStatus(r.Context(), namespace, clusterNameFromQuery(config.Get(), r.URL.Query()))
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
	namespaceNamesFromQuery := map[string]struct{}{}
	if len(namespaces) > 0 {
		for _, name := range strings.Split(namespaces, ",") {
			namespaceNamesFromQuery[name] = struct{}{}
		}
	}
	cluster := clusterNameFromQuery(config.Get(), params)

	business, err := getBusiness(r)
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	namespaceModels, err := business.Namespace.GetClusterNamespaces(r.Context(), cluster)
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if len(namespaceNamesFromQuery) != 0 {
		// Filter out the namespaces included in the query param that don't exist in the cluster.
		namespaceModels = sliceutil.Filter(namespaceModels, func(ns models.Namespace) bool {
			_, found := namespaceNamesFromQuery[ns.Name]
			return found
		})
	}
	status, err := business.TLS.ClusterWideNSmTLSStatus(r.Context(), namespaceModels, cluster)
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

	cluster := clusterNameFromQuery(config.Get(), r.URL.Query())
	revision := r.URL.Query().Get("revision")
	if revision == "" {
		revision = "default"
	}

	// Get mtls status given the whole namespaces
	globalmTLSStatus, err := business.TLS.MeshWidemTLSStatus(ctx, cluster, revision)
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, globalmTLSStatus)
}
