package handlers

import (
	"context"
	"io"
	"net/http"
	"strings"
	"sync"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
)

func IstioConfigList(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	namespace := params["namespace"]
	query := r.URL.Query()
	objects := ""
	parsedTypes := make([]string, 0)
	if _, ok := query["objects"]; ok {
		objects = strings.ToLower(query.Get("objects"))
		if len(objects) > 0 {
			parsedTypes = strings.Split(objects, ",")
		}
	}
	namespaces := query.Get("namespaces") // csl of namespaces
	nss := []string{}
	if len(namespaces) > 0 {
		nss = strings.Split(namespaces, ",")
	}

	allNamespaces := false
	if namespace == "" {
		allNamespaces = true
	}

	includeValidations := false
	if _, found := query["validate"]; found {
		includeValidations = true
	}

	labelSelector := ""
	if _, found := query["labelSelector"]; found {
		labelSelector = query.Get("labelSelector")
	}

	workloadSelector := ""
	if _, found := query["workloadSelector"]; found {
		workloadSelector = query.Get("workloadSelector")
	}

	cluster := clusterNameFromQuery(query)
	if !config.Get().ExternalServices.Istio.IstioAPIEnabled {
		includeValidations = false
	}

	criteria := business.ParseIstioConfigCriteria(cluster, namespace, objects, labelSelector, workloadSelector, allNamespaces)

	// Get business layer
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	if allNamespaces && len(nss) == 0 {
		loadedNamespaces, _ := business.Namespace.GetClusterNamespaces(r.Context(), cluster)
		for _, ns := range loadedNamespaces {
			nss = append(nss, ns.Name)
		}
	}

	var istioConfigValidations models.IstioValidations

	wg := sync.WaitGroup{}
	if includeValidations {
		wg.Add(1)
		go func(namespace string, istioConfigValidations *models.IstioValidations, err *error) {
			defer wg.Done()
			istioConfigValidationResults := models.IstioValidations{}
			var errValidations error
			// We don't filter by service and workload when calling validations, because certain validations require fetching all types to get the correct errors
			// when namespace is empty, validaions should be done per all namespaces to apply object filters
			if namespace == "" && len(nss) > 0 {
				for _, ns := range nss {
					nsValidations, nsErr := business.Validations.GetValidations(context.TODO(), cluster, ns, "", "")
					if nsErr == nil {
						istioConfigValidationResults = istioConfigValidationResults.MergeValidations(nsValidations)
					} else {
						errValidations = nsErr
					}
				}
			} else {
				istioConfigValidationResults, errValidations = business.Validations.GetValidations(context.TODO(), cluster, namespace, "", "")
			}
			if errValidations != nil && *err == nil {
				*err = errValidations
			} else {
				if len(parsedTypes) > 0 {
					istioConfigValidationResults = istioConfigValidationResults.FilterByTypes(parsedTypes)
				}
				*istioConfigValidations = istioConfigValidationResults
			}
		}(namespace, &istioConfigValidations, &err)
	}

	istioConfig := models.IstioConfigList{}

	// This can result on an error when IstioAPI is disabled, so filter here
	// Even if all namespaces are not accessible, but the IstioAPI is enabled, still use the Istio Registry by AllNamespaces=true
	if criteria.AllNamespaces && !config.Get().AllNamespacesAccessible() && !config.Get().ExternalServices.Istio.IstioAPIEnabled {
		criteria.AllNamespaces = false
		for _, ns := range nss {
			criteria.Namespace = ns
			istioConfigNs, _ := business.IstioConfig.GetIstioConfigList(r.Context(), criteria)
			istioConfig = istioConfig.MergeConfigs(istioConfigNs)
		}
	} else {
		istioConfig, err = business.IstioConfig.GetIstioConfigList(r.Context(), criteria)
	}

	if includeValidations {
		// Add validation results to the IstioConfigList once they're available (previously done in the UI layer)
		wg.Wait()
		istioConfig.IstioValidations = istioConfigValidations
	}

	if err != nil {
		handleErrorResponse(w, err)
		return
	}

	if len(nss) > 0 {
		// From allNamespaces load only requested ones
		RespondWithJSON(w, http.StatusOK, istioConfig.FilterIstioConfigs(nss))
	} else {
		RespondWithJSON(w, http.StatusOK, istioConfig)
	}
}

func IstioConfigDetails(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	namespace := params["namespace"]
	objectType := params["object_type"]
	object := params["object"]

	includeValidations := false
	query := r.URL.Query()
	if _, found := query["validate"]; found {
		includeValidations = true
	}

	includeHelp := false
	if _, found := query["help"]; found {
		includeHelp = true
	}

	cluster := clusterNameFromQuery(query)
	if !config.Get().ExternalServices.Istio.IstioAPIEnabled {
		includeValidations = false
	}

	if !checkObjectType(objectType) {
		RespondWithError(w, http.StatusBadRequest, "Object type not managed: "+objectType)
		return
	}

	// Get business layer
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	var istioConfigValidations models.IstioValidations
	var istioConfigReferences models.IstioReferencesMap

	validationsResult := make(chan error)
	if includeValidations {
		go func(istioConfigValidations *models.IstioValidations, istioConfigReferences *models.IstioReferencesMap) {
			defer func() {
				close(validationsResult)
			}()

			istioConfigValidationResults, istioConfigReferencesResults, err := business.Validations.GetIstioObjectValidations(r.Context(), cluster, namespace, objectType, object)
			if err != nil {
				validationsResult <- err
			}
			*istioConfigValidations = istioConfigValidationResults
			*istioConfigReferences = istioConfigReferencesResults
		}(&istioConfigValidations, &istioConfigReferences)
	}

	istioConfigDetails, err := business.IstioConfig.GetIstioConfigDetails(context.TODO(), cluster, namespace, objectType, object)
	if err != nil {
		handleErrorResponse(w, err)
		return
	}

	if includeHelp {
		istioConfigDetails.IstioConfigHelpFields = models.IstioConfigHelpMessages[objectType]
	}

	if includeValidations {
		err := <-validationsResult
		if err != nil {
			handleErrorResponse(w, err)
			return
		}

		if validation, found := istioConfigValidations[models.IstioValidationKey{ObjectType: models.ObjectTypeSingular[objectType], Namespace: namespace, Name: object}]; found {
			istioConfigDetails.IstioValidation = validation
		}
		if references, found := istioConfigReferences[models.IstioReferenceKey{ObjectType: models.ObjectTypeSingular[objectType], Namespace: namespace, Name: object}]; found {
			istioConfigDetails.IstioReferences = references
		}
	}

	RespondWithJSON(w, http.StatusOK, istioConfigDetails)
}

func IstioConfigDelete(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	namespace := params["namespace"]
	objectType := params["object_type"]
	object := params["object"]

	query := r.URL.Query()
	cluster := clusterNameFromQuery(query)

	if !business.GetIstioAPI(objectType) {
		RespondWithError(w, http.StatusBadRequest, "Object type not managed: "+objectType)
		return
	}

	// Get business layer
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}
	err = business.IstioConfig.DeleteIstioConfigDetail(r.Context(), cluster, namespace, objectType, object)
	if err != nil {
		handleErrorResponse(w, err)
		return
	} else {
		audit(r, "DELETE on Namespace: "+namespace+" Type: "+objectType+" Name: "+object)
		RespondWithCode(w, http.StatusOK)
	}
}

func IstioConfigUpdate(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	namespace := params["namespace"]
	objectType := params["object_type"]
	object := params["object"]

	query := r.URL.Query()
	cluster := clusterNameFromQuery(query)

	if !business.GetIstioAPI(objectType) {
		RespondWithError(w, http.StatusBadRequest, "Object type not managed: "+objectType)
		return
	}

	// Get business layer
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, "Update request with bad update patch: "+err.Error())
	}
	jsonPatch := string(body)
	updatedConfigDetails, err := business.IstioConfig.UpdateIstioConfigDetail(r.Context(), cluster, namespace, objectType, object, jsonPatch)
	if err != nil {
		handleErrorResponse(w, err)
		return
	}

	audit(r, "UPDATE on Namespace: "+namespace+" Type: "+objectType+" Name: "+object+" Patch: "+jsonPatch)
	RespondWithJSON(w, http.StatusOK, updatedConfigDetails)
}

func IstioConfigCreate(w http.ResponseWriter, r *http.Request) {
	// Feels kinda replicated for multiple functions..
	params := mux.Vars(r)
	namespace := params["namespace"]
	objectType := params["object_type"]

	query := r.URL.Query()
	cluster := clusterNameFromQuery(query)

	if !business.GetIstioAPI(objectType) {
		RespondWithError(w, http.StatusBadRequest, "Object type not managed: "+objectType)
		return
	}

	// Get business layer
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, "Create request could not be read: "+err.Error())
	}

	createdConfigDetails, err := business.IstioConfig.CreateIstioConfigDetail(r.Context(), cluster, namespace, objectType, body)
	if err != nil {
		handleErrorResponse(w, err)
		return
	}

	audit(r, "CREATE on Namespace: "+namespace+" Type: "+objectType+" Object: "+string(body))
	RespondWithJSON(w, http.StatusOK, createdConfigDetails)
}

func checkObjectType(objectType string) bool {
	return business.GetIstioAPI(objectType)
}

func audit(r *http.Request, message string) {
	if config.Get().Server.AuditLog {
		user := r.Header.Get("Kiali-User")
		log.Infof("AUDIT User [%s] Msg [%s]", user, message)
	}
}

func IstioConfigPermissions(w http.ResponseWriter, r *http.Request) {
	// query params
	params := r.URL.Query()
	namespaces := params.Get("namespaces") // csl of namespaces
	cluster := clusterNameFromQuery(params)

	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	if !business.Mesh.IsValidCluster(cluster) {
		RespondWithError(w, http.StatusBadRequest, "Cluster %s does not exist "+cluster)
		return
	}

	istioConfigPermissions := models.IstioConfigPermissions{}
	if len(namespaces) > 0 {
		ns := strings.Split(namespaces, ",")
		istioConfigPermissions = business.IstioConfig.GetIstioConfigPermissions(r.Context(), ns, cluster)
	}
	RespondWithJSON(w, http.StatusOK, istioConfigPermissions)
}
