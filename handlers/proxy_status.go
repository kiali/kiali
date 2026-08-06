package handlers

import (
	"net/http"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/handlers/queryparams"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
)

func ConfigDump(conf *config.Config, kialiCache cache.KialiCache, clientFactory kubernetes.ClientFactory, discovery istio.MeshDiscovery) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		params := mux.Vars(r)

		query := r.URL.Query()
		if err := queryparams.RejectUnknown(query, "clusterName"); err != nil {
			RespondWithQueryParamError(w, err.Error())
			return
		}

		cluster := queryparams.ClusterName(conf, query)
		namespace := params["namespace"]
		pod := params["pod"]

		userClients, err := getUserClients(r, clientFactory)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
			return
		}

		namespaceService := business.NewNamespaceService(kialiCache, conf, discovery, clientFactory.GetSAClients(), userClients)
		_, err = namespaceService.GetClusterNamespace(r.Context(), namespace, cluster)
		if err != nil {
			handleErrorResponse(w, err)
			return
		}

		proxyStatus := business.NewProxyStatusService(conf, kialiCache, discovery, clientFactory.GetSAClients(), &namespaceService)
		dump, err := proxyStatus.GetConfigDump(cluster, namespace, pod)
		if err != nil {
			handleErrorResponse(w, err)
			return
		}

		RespondWithJSON(w, http.StatusOK, dump)
	}
}

func ConfigDumpResourceEntries(conf *config.Config, kialiCache cache.KialiCache, clientFactory kubernetes.ClientFactory, discovery istio.MeshDiscovery) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		params := mux.Vars(r)

		query := r.URL.Query()
		if err := queryparams.RejectUnknown(query, "clusterName"); err != nil {
			RespondWithQueryParamError(w, err.Error())
			return
		}

		cluster := queryparams.ClusterName(conf, query)
		namespace := params["namespace"]
		pod := params["pod"]
		resource := params["resource"]

		userClients, err := getUserClients(r, clientFactory)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
			return
		}

		namespaceService := business.NewNamespaceService(kialiCache, conf, discovery, clientFactory.GetSAClients(), userClients)
		_, err = namespaceService.GetClusterNamespace(r.Context(), namespace, cluster)
		if err != nil {
			handleErrorResponse(w, err)
			return
		}

		proxyStatus := business.NewProxyStatusService(conf, kialiCache, discovery, clientFactory.GetSAClients(), &namespaceService)
		dump, err := proxyStatus.GetConfigDumpResourceEntries(r.Context(), cluster, namespace, pod, resource)
		if err != nil {
			handleErrorResponse(w, err)
			return
		}

		RespondWithJSON(w, http.StatusOK, dump)
	}
}
