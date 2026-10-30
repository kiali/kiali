package handlers

import (
	"net/http"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/handlers/queryparams"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/tracing"
)

func NamespaceList(conf *config.Config, kialiCache cache.KialiCache, clientFactory kubernetes.ClientFactory, discovery istio.MeshDiscovery) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userClients, err := getUserClients(r, clientFactory)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
			return
		}

		namespace := business.NewNamespaceService(kialiCache, conf, discovery, clientFactory.GetSAClients(), userClients)

		namespaces, err := namespace.GetNamespaces(r.Context())
		if err != nil {
			log.Error(err)
			RespondWithError(w, http.StatusInternalServerError, err.Error())
			return
		}

		RespondWithJSON(w, http.StatusOK, namespaces)
	}
}

func NamespaceInfo(conf *config.Config, cache cache.KialiCache, clientFactory kubernetes.ClientFactory, discovery istio.MeshDiscovery) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query()
		if err := queryparams.RejectUnknown(query, "clusterName"); err != nil {
			RespondWithQueryParamError(w, err.Error())
			return
		}
		vars := mux.Vars(r)
		namespace := vars["namespace"]
		cluster := queryparams.ClusterName(conf, query)

		userClients, err := getUserClients(r, clientFactory)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, err.Error())
			return
		}

		namespaceService := business.NewNamespaceService(cache, conf, discovery, clientFactory.GetSAClients(), userClients)
		namespaceInfo, err := namespaceService.GetClusterNamespace(r.Context(), namespace, cluster)
		if err != nil {
			if business.IsAccessibleError(err) {
				respondNamespaceAccessError(w, err)
				return
			}
			log.Error(err)
			RespondWithError(w, http.StatusInternalServerError, err.Error())
			return
		}

		RespondWithJSON(w, http.StatusOK, namespaceInfo)
	}
}

// NamespaceValidationSummary is the API handler to fetch validations summary to be displayed.
// It is related to all the Istio Objects within the namespace
func NamespaceValidationSummary(
	conf *config.Config,
	kialiCache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	prom prometheus.ClientInterface,
	cpm business.ControlPlaneMonitor,
	traceClientLoader func() tracing.ClientInterface,
	grafana *grafana.Service,
	discovery *istio.Discovery,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query()
		if err := queryparams.RejectUnknown(query, "clusterName"); err != nil {
			RespondWithQueryParamError(w, err.Error())
			return
		}
		vars := mux.Vars(r)
		namespace := vars["namespace"]

		cluster := queryparams.ClusterName(conf, query)

		business, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
			return
		}

		var validationSummary models.IstioValidationSummary
		istioConfigValidationResults := models.IstioValidations{}

		// Single-cluster mesh: gate on the requested cluster — inaccessible
		// means 403. Multi-cluster: merge summaries from the clusters where
		// the namespace is in the user's accessible set (the cluster param is
		// ignored, as before), and 403 when it is accessible nowhere.
		clusters := discovery.Clusters()
		accessibleNowhere := true
		if len(clusters) == 1 {
			istioConfigValidationResults, err = business.Validations.GetValidationsForNamespace(r.Context(), cluster, namespace)
			if err != nil {
				handleErrorResponse(w, err)
				return
			}
		} else {
			for _, cl := range clusters {
				_, errNs := business.Namespace.GetClusterNamespace(r.Context(), namespace, cl.Name)
				if errNs == nil {
					accessibleNowhere = false
					clusterIstioConfigValidationResults, errValidations := business.Validations.GetValidationsForNamespace(r.Context(), cl.Name, namespace)
					if errValidations != nil {
						// A single cluster's validation failure must not fail
						// the merged view (remote-cluster tolerance), but it
						// is logged rather than silently swallowed.
						log.FromRequest(r).Error().Msgf("Error fetching validations for namespace [%s] in cluster [%s]: %s", namespace, cl.Name, errValidations.Error())
						continue
					}
					istioConfigValidationResults = istioConfigValidationResults.MergeValidations(clusterIstioConfigValidationResults)
				}
			}
			if accessibleNowhere {
				respondNamespaceNotAccessible(w, namespace)
				return
			}
		}

		validationSummary = *istioConfigValidationResults.SummarizeValidation(namespace, cluster)

		RespondWithJSON(w, http.StatusOK, validationSummary)
	}
}

// NamespaceUpdate is the API to perform a patch on a Namespace configuration
func NamespaceUpdate(conf *config.Config, kialiCache cache.KialiCache, clientFactory kubernetes.ClientFactory, discovery istio.MeshDiscovery) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		params := mux.Vars(r)
		namespace := params["namespace"]
		body, err := boundedReadAll(r)
		if err != nil {
			RespondWithError(w, http.StatusBadRequest, "Update request with bad update patch: "+err.Error())
			return
		}
		defer r.Body.Close()

		jsonPatch := string(body)

		query := r.URL.Query()
		if err := queryparams.RejectUnknown(query, "clusterName"); err != nil {
			RespondWithQueryParamError(w, err.Error())
			return
		}
		cluster := queryparams.ClusterName(conf, query)

		userClients, err := getUserClients(r, clientFactory)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
			return
		}

		namespaceService := business.NewNamespaceService(kialiCache, conf, discovery, clientFactory.GetSAClients(), userClients)
		ns, err := namespaceService.UpdateNamespace(r.Context(), namespace, jsonPatch, cluster)
		if err != nil {
			handleErrorResponse(w, err)
			return
		}
		audit(r, "UPDATE", namespace, "n/a", "Namespace Update. Patch: "+jsonPatch)
		RespondWithJSON(w, http.StatusOK, ns)
	}
}
