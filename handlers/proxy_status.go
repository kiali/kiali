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

// gatedProxyStatusService gates the namespace with the canonical check and
// returns the ProxyStatusService built on the request's NamespaceService,
// which is reused so the gate and the business layer share one
// accessible-set cache entry. The Envoy config dump is fetched via istiod
// port-forward with the Kiali ServiceAccount, so the Kubernetes API cannot
// enforce the user's RBAC. It returns nil when a response has already been
// written.
func gatedProxyStatusService(
	w http.ResponseWriter,
	r *http.Request,
	conf *config.Config,
	kialiCache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	discovery istio.MeshDiscovery,
	namespace string,
	cluster string,
) *business.ProxyStatusService {
	namespaceService := namespaceServiceForRequest(w, r, conf, kialiCache, discovery, clientFactory)
	if namespaceService == nil {
		return nil // 500 already written
	}
	if _, err := checkNamespaceAccessOn(w, r, namespaceService, namespace, cluster); err != nil {
		return nil
	}
	proxyStatus := business.NewProxyStatusService(conf, kialiCache, discovery, clientFactory.GetSAClients(), namespaceService)
	return &proxyStatus
}

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

		proxyStatus := gatedProxyStatusService(w, r, conf, kialiCache, clientFactory, discovery, namespace, cluster)
		if proxyStatus == nil {
			return
		}
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

		proxyStatus := gatedProxyStatusService(w, r, conf, kialiCache, clientFactory, discovery, namespace, cluster)
		if proxyStatus == nil {
			return
		}
		dump, err := proxyStatus.GetConfigDumpResourceEntries(r.Context(), cluster, namespace, pod, resource)
		if err != nil {
			handleErrorResponse(w, err)
			return
		}

		RespondWithJSON(w, http.StatusOK, dump)
	}
}
