package handlers

import (
	"net/http"
	"strings"

	"github.com/gorilla/mux"
	"k8s.io/apimachinery/pkg/runtime/schema"

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
	"github.com/kiali/kiali/util/sliceutil"
)

func IstioConfigList(
	conf *config.Config,
	kialiCache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	prom prometheus.ClientInterface,
	traceClientLoader func() tracing.ClientInterface,
	discovery istio.MeshDiscovery,
	cpm business.ControlPlaneMonitor,
	grafana *grafana.Service,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {

		params := mux.Vars(r)
		namespace := params["namespace"]
		query := r.URL.Query()

		listParams, err := parseIstioConfigListParams(conf, query)
		if respondQueryParamError(w, err) {
			return
		}

		parsedTypes := make([]string, 0)
		if len(listParams.Objects) > 0 {
			parsedTypes = strings.Split(listParams.Objects, ";")
		}

		criteria := business.ParseIstioConfigCriteria(listParams.Objects, listParams.LabelSelector, listParams.WorkloadSelector)
		cluster := listParams.ClusterName
		includeValidations := listParams.IncludeValidations

		business, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
			return
		}

		var istioConfig *models.IstioConfigList
		if namespace != "" {
			istioConfig, err = business.IstioConfig.GetIstioConfigListForNamespace(r.Context(), cluster, namespace, criteria)
			if err != nil {
				handleErrorResponse(w, err)
				return
			}
		} else {
			istioConfig, err = business.IstioConfig.GetIstioConfigList(r.Context(), cluster, criteria)
			if err != nil {
				handleErrorResponse(w, err)
				return
			}
		}

		if includeValidations {
			// Namespace-scoped list should only return validations for that namespace.
			// Cluster-wide list (/api/istio/config) keeps cluster validations.
			if namespace != "" {
				istioConfig.IstioValidations, err = business.Validations.GetValidationsForNamespace(r.Context(), cluster, namespace)
			} else {
				istioConfig.IstioValidations, err = business.Validations.GetValidations(r.Context(), cluster)
			}
			if err != nil {
				RespondWithError(w, http.StatusInternalServerError, "Error while getting validations: "+err.Error())
				return
			}

			// We don't filter by objects when calling validations, because certain validations require fetching all types to get the correct errors
			if len(parsedTypes) > 0 {
				istioConfig.IstioValidations = istioConfig.IstioValidations.FilterByTypes(parsedTypes)
			}
		}

		RespondWithAPIResponse(w, http.StatusOK, istioConfig)
	}
}

func IstioConfigDetails(
	conf *config.Config,
	kialiCache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	prom prometheus.ClientInterface,
	traceClientLoader func() tracing.ClientInterface,
	discovery istio.MeshDiscovery,
	cpm business.ControlPlaneMonitor,
	grafana *grafana.Service,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {

		params := mux.Vars(r)
		namespace := params["namespace"]
		objectGroup := params["group"]
		objectVersion := params["version"]
		objectKind := params["kind"]
		object := params["object"]

		query := r.URL.Query()
		detailsParams, err := parseIstioConfigDetailsParams(conf, query)
		if respondQueryParamError(w, err) {
			return
		}

		cluster := detailsParams.ClusterName
		includeValidations := detailsParams.IncludeValidations
		includeHelp := detailsParams.IncludeHelp

		gvk := schema.GroupVersionKind{
			Group:   objectGroup,
			Version: objectVersion,
			Kind:    objectKind,
		}

		if !checkObjectType(gvk) {
			RespondWithError(w, http.StatusBadRequest, "Object type not managed: "+gvk.String())
			return
		}

		business, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
			return
		}

		istioConfigDetails, err := business.IstioConfig.GetIstioConfigDetails(r.Context(), cluster, namespace, gvk, object)
		if err != nil {
			handleErrorResponse(w, err)
			return
		}

		exportTo := istioConfigDetails.GetExportTo()
		istioConfigValidations := models.IstioValidations{}
		istioConfigReferences := models.IstioReferencesMap{}

		validationsResult := make(chan error)
		if includeValidations {
			go func(istioConfigValidations *models.IstioValidations, istioConfigReferences *models.IstioReferencesMap) {
				defer func() {
					close(validationsResult)
				}()
				if len(exportTo) != 0 {
					// validations should be done per exported namespaces to apply exportTo configs
					loadedNamespaces, _ := business.Namespace.GetClusterNamespaces(r.Context(), cluster)
					for _, ns := range loadedNamespaces {
						if sliceutil.SomeString(exportTo, ns.Name) && ns.Name != namespace {
							istioConfigValidationResults, istioConfigReferencesResults, err := business.Validations.ValidateIstioObject(r.Context(), cluster, ns.Name, gvk, object)
							if err != nil {
								validationsResult <- err
							}
							*istioConfigValidations = istioConfigValidations.MergeValidations(istioConfigValidationResults)
							*istioConfigReferences = istioConfigReferences.MergeReferencesMap(istioConfigReferencesResults)
						}
					}
				}
				// also validate own namespace
				istioConfigValidationResults, istioConfigReferencesResults, err := business.Validations.ValidateIstioObject(r.Context(), cluster, namespace, gvk, object)
				if err != nil {
					validationsResult <- err
				}
				*istioConfigValidations = istioConfigValidations.MergeValidations(istioConfigValidationResults)
				*istioConfigReferences = istioConfigReferences.MergeReferencesMap(istioConfigReferencesResults)
			}(&istioConfigValidations, &istioConfigReferences)
		}

		if includeHelp {
			istioConfigDetails.IstioConfigHelpFields = models.IstioConfigHelpMessages[gvk.String()]
		}

		if includeValidations {
			err := <-validationsResult
			if err != nil {
				handleErrorResponse(w, err)
				return
			}

			if validation, found := istioConfigValidations[models.IstioValidationKey{ObjectGVK: gvk, Namespace: namespace, Name: object, Cluster: cluster}]; found {
				istioConfigDetails.IstioValidation = validation
			}
			if references, found := istioConfigReferences[models.IstioReferenceKey{ObjectGVK: gvk, Namespace: namespace, Name: object}]; found {
				istioConfigDetails.IstioReferences = references
			}
		}

		RespondWithJSON(w, http.StatusOK, istioConfigDetails)
	}
}

func IstioConfigDelete(
	conf *config.Config,
	kialiCache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	prom prometheus.ClientInterface,
	traceClientLoader func() tracing.ClientInterface,
	discovery istio.MeshDiscovery,
	cpm business.ControlPlaneMonitor,
	grafana *grafana.Service,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {

		params := mux.Vars(r)
		namespace := params["namespace"]
		objectGroup := params["group"]
		objectVersion := params["version"]
		objectKind := params["kind"]
		object := params["object"]

		query := r.URL.Query()
		cluster, err := parseIstioConfigClusterParams(conf, query)
		if respondQueryParamError(w, err) {
			return
		}

		gvk := schema.GroupVersionKind{
			Group:   objectGroup,
			Version: objectVersion,
			Kind:    objectKind,
		}

		if !business.GetIstioAPI(gvk) {
			RespondWithError(w, http.StatusBadRequest, "Object type not managed: "+gvk.String())
			return
		}

		business, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
			return
		}
		err = business.IstioConfig.DeleteIstioConfigDetail(r.Context(), cluster, namespace, gvk, object)
		if err != nil {
			handleErrorResponse(w, err)
			return
		} else {
			audit(r, "DELETE", namespace, gvk.String(), "Name: ["+object+"]")
			RespondWithCode(w, http.StatusOK)
		}
	}
}

func IstioConfigUpdate(
	conf *config.Config,
	kialiCache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	prom prometheus.ClientInterface,
	traceClientLoader func() tracing.ClientInterface,
	discovery istio.MeshDiscovery,
	cpm business.ControlPlaneMonitor,
	grafana *grafana.Service,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {

		params := mux.Vars(r)
		namespace := params["namespace"]
		objectGroup := params["group"]
		objectVersion := params["version"]
		objectKind := params["kind"]
		object := params["object"]

		query := r.URL.Query()
		cluster, err := parseIstioConfigClusterParams(conf, query)
		if respondQueryParamError(w, err) {
			return
		}

		gvk := schema.GroupVersionKind{
			Group:   objectGroup,
			Version: objectVersion,
			Kind:    objectKind,
		}

		if !business.GetIstioAPI(gvk) {
			RespondWithError(w, http.StatusBadRequest, "Object type not managed: "+gvk.String())
			return
		}

		business, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
			return
		}

		body, err := boundedReadAll(r)
		if err != nil {
			RespondWithError(w, http.StatusBadRequest, "Update request with bad update patch: "+err.Error())
			return
		}
		jsonPatch := string(body)
		updatedConfigDetails, err := business.IstioConfig.UpdateIstioConfigDetail(r.Context(), cluster, namespace, gvk, object, jsonPatch)
		if err != nil {
			handleErrorResponse(w, err)
			return
		}

		audit(r, "UPDATE", namespace, gvk.String(), "Name: ["+object+"], Patch: "+jsonPatch)
		RespondWithJSON(w, http.StatusOK, updatedConfigDetails)
	}
}

func IstioConfigCreate(
	conf *config.Config,
	kialiCache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	prom prometheus.ClientInterface,
	traceClientLoader func() tracing.ClientInterface,
	discovery istio.MeshDiscovery,
	cpm business.ControlPlaneMonitor,
	grafana *grafana.Service,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {

		// Feels kinda replicated for multiple functions..
		params := mux.Vars(r)
		namespace := params["namespace"]
		objectGroup := params["group"]
		objectVersion := params["version"]
		objectKind := params["kind"]

		query := r.URL.Query()
		cluster, err := parseIstioConfigClusterParams(conf, query)
		if respondQueryParamError(w, err) {
			return
		}

		gvk := schema.GroupVersionKind{
			Group:   objectGroup,
			Version: objectVersion,
			Kind:    objectKind,
		}

		if !business.GetIstioAPI(gvk) {
			RespondWithError(w, http.StatusBadRequest, "Object type not managed: "+gvk.String())
			return
		}

		business, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
			return
		}

		body, err := boundedReadAll(r)
		if err != nil {
			RespondWithError(w, http.StatusBadRequest, "Create request could not be read: "+err.Error())
			return
		}

		createdConfigDetails, err := business.IstioConfig.CreateIstioConfigDetail(r.Context(), cluster, namespace, gvk, body)
		if err != nil {
			handleErrorResponse(w, err)
			return
		}

		audit(r, "CREATE", namespace, gvk.String(), "Object: "+string(body))
		RespondWithJSON(w, http.StatusOK, createdConfigDetails)
	}
}

func checkObjectType(gvk schema.GroupVersionKind) bool {
	return business.GetIstioAPI(gvk)
}

func audit(r *http.Request, operation, namespace, gvk, message string) {
	if config.Get().Server.AuditLog {
		user := r.Header.Get("Kiali-User")
		log.FromRequest(r).
			Info().
			Str("operation", operation).
			Str("namespace", namespace).
			Str("gvk", gvk).
			Str("user", user).
			Msgf("AUDIT: %s", message)
	}
}

func IstioConfigPermissions(
	conf *config.Config,
	kialiCache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	prom prometheus.ClientInterface,
	traceClientLoader func() tracing.ClientInterface,
	discovery istio.MeshDiscovery,
	cpm business.ControlPlaneMonitor,
	grafana *grafana.Service,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {

		// query params
		params := r.URL.Query()
		cluster, namespaces, err := parseIstioConfigNamespacesParams(conf, params)
		if respondQueryParamError(w, err) {
			return
		}

		business, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
			return
		}

		if !business.Mesh.IsValidCluster(cluster) {
			RespondWithError(w, http.StatusBadRequest, "Cluster [%s] does not exist "+cluster)
			return
		}

		istioConfigPermissions := models.IstioConfigPermissions{}
		if len(namespaces) > 0 {
			ns := strings.Split(namespaces, ",")
			istioConfigPermissions = business.IstioConfig.GetIstioConfigPermissions(r.Context(), ns, cluster)
		}
		RespondWithJSON(w, http.StatusOK, istioConfigPermissions)
	}
}

// IstioConfigValidationSummary is the API handler to fetch validations summary to be displayed.
// It is related to all the Istio Objects within given namespaces
func IstioConfigValidationSummary(
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

		params := r.URL.Query()
		cluster, namespaces, err := parseIstioConfigNamespacesParams(conf, params)
		if respondQueryParamError(w, err) {
			return
		}
		nss := []string{}
		if len(namespaces) > 0 {
			nss = strings.Split(namespaces, ",")
		}

		business, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
			return
		}

		if len(nss) == 0 {
			loadedNamespaces, _ := business.Namespace.GetClusterNamespaces(r.Context(), cluster)
			for _, ns := range loadedNamespaces {
				nss = append(nss, ns.Name)
			}
		}

		validationSummaries := []models.IstioValidationSummary{}
		for _, ns := range nss {
			istioConfigValidationResults, errValidations := business.Validations.GetValidationsForNamespace(r.Context(), cluster, ns)
			if errValidations != nil {
				log.FromRequest(r).Error().Msg(errValidations.Error())
				RespondWithError(w, http.StatusInternalServerError, errValidations.Error())
				return
			}
			validationSummaries = append(validationSummaries, *istioConfigValidationResults.SummarizeValidation(ns, cluster))
		}

		RespondWithJSON(w, http.StatusOK, validationSummaries)
	}
}
