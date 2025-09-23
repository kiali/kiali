package handlers

import (
	"io"
	"net/http"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
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
		vars := mux.Vars(r)
		namespace := vars["namespace"]
		cluster := clusterNameFromQuery(conf, query)

		userClients, err := getUserClients(r, clientFactory)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, err.Error())
			return
		}

		namespaceService := business.NewNamespaceService(cache, conf, discovery, clientFactory.GetSAClients(), userClients)
		namespaceInfo, err := namespaceService.GetClusterNamespace(r.Context(), namespace, cluster)
		if err != nil {
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
		vars := mux.Vars(r)
		namespace := vars["namespace"]

		cluster := clusterNameFromQuery(conf, query)

		business, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
			return
		}

		var validationSummary models.IstioValidationSummary
		istioConfigValidationResults := models.IstioValidations{}
		var errValidations error

		// If cluster is not set, is because we need a unified validations view (E.g. in the Summary graph)
		clusters := discovery.Clusters()
		if len(clusters) == 1 {
			istioConfigValidationResults, errValidations = business.Validations.GetValidationsForNamespace(r.Context(), cluster, namespace)
		} else {
			for _, cl := range clusters {
				_, errNs := business.Namespace.GetClusterNamespace(r.Context(), namespace, cl.Name)
				if errNs == nil {
					clusterIstioConfigValidationResults, _ := business.Validations.GetValidationsForNamespace(r.Context(), cl.Name, namespace)
					istioConfigValidationResults = istioConfigValidationResults.MergeValidations(clusterIstioConfigValidationResults)
				}
			}
		}

		if errValidations != nil {
			log.FromRequest(r).Error().Msg(errValidations.Error())
			RespondWithError(w, http.StatusInternalServerError, errValidations.Error())
		} else {
			validationSummary = *istioConfigValidationResults.SummarizeValidation(namespace, cluster)
		}

		RespondWithJSON(w, http.StatusOK, validationSummary)
	}
}

// NamespaceUpdate is the API to perform a patch on a Namespace configuration
func NamespaceUpdate(conf *config.Config, kialiCache cache.KialiCache, clientFactory kubernetes.ClientFactory, discovery istio.MeshDiscovery) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		params := mux.Vars(r)
		namespace := params["namespace"]
		body, err := io.ReadAll(r.Body)
		if err != nil {
			RespondWithError(w, http.StatusBadRequest, "Update request with bad update patch: "+err.Error())
			return
		}
		defer r.Body.Close()

		jsonPatch := string(body)

		query := r.URL.Query()
		cluster := clusterNameFromQuery(conf, query)

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
