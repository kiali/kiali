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

		// The Envoy config dump is fetched via istiod port-forward with the
		// Kiali ServiceAccount, so the Kubernetes API cannot enforce the
		// user's RBAC: gate the namespace with the canonical check, reusing
		// the NamespaceService for the proxy status business layer below.
		namespaceService := namespaceServiceForRequest(w, r, conf, kialiCache, discovery, clientFactory)
		if namespaceService == nil {
			return // 500 already written
		}
		if _, err := checkNamespaceAccessOn(w, r, namespaceService, namespace, cluster); err != nil {
			return
		}

		proxyStatus := business.NewProxyStatusService(conf, kialiCache, discovery, clientFactory.GetSAClients(), namespaceService)
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

		// The Envoy config dump is fetched via istiod port-forward with the
		// Kiali ServiceAccount, so the Kubernetes API cannot enforce the
		// user's RBAC: gate the namespace with the canonical check, reusing
		// the NamespaceService for the proxy status business layer below.
		namespaceService := namespaceServiceForRequest(w, r, conf, kialiCache, discovery, clientFactory)
		if namespaceService == nil {
			return // 500 already written
		}
		if _, err := checkNamespaceAccessOn(w, r, namespaceService, namespace, cluster); err != nil {
			return
		}

		proxyStatus := business.NewProxyStatusService(conf, kialiCache, discovery, clientFactory.GetSAClients(), namespaceService)
		dump, err := proxyStatus.GetConfigDumpResourceEntries(r.Context(), cluster, namespace, pod, resource)
		if err != nil {
			handleErrorResponse(w, err)
			return
		}

		RespondWithJSON(w, http.StatusOK, dump)
	}
}
