package handlers

import (
	"context"
	"io"
	"net/http"
	"strings"

	"github.com/gorilla/mux"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util"
)

func IstioConfigList(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	namespace := params["namespace"]
	query := r.URL.Query()
	objects := ""
	parsedTypes := make([]string, 0)
	if _, ok := query["objects"]; ok {
		objects = query.Get("objects")
		if len(objects) > 0 {
			parsedTypes = strings.Split(objects, ";")
		}
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

	criteria := business.ParseIstioConfigCriteria(objects, labelSelector, workloadSelector)

	// Get business layer
	business, err := getBusiness(r)
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
		// We don't filter by service and workload when calling validations, because certain validations require fetching all types to get the correct errors
		if namespace == "" {
			// when namespace is empty, validations should be done per namespaces to apply exportTo configs
			loadedNamespaces, _ := business.Namespace.GetClusterNamespaces(r.Context(), cluster)
			istioConfig.IstioValidations = models.IstioValidations{}
			for _, ns := range loadedNamespaces {
				nsValidations, nsErr := business.Validations.GetValidations(r.Context(), cluster, ns.Name, "", "")
				if nsErr != nil {
					handleErrorResponse(w, nsErr)
					return
				}
				istioConfig.IstioValidations.MergeValidations(nsValidations)
			}
		} else {
			// when namespace is provided, do validations for that namespace only
			istioConfig.IstioValidations, err = business.Validations.GetValidations(r.Context(), cluster, namespace, "", "")
			if err != nil {
				handleErrorResponse(w, err)
				return
			}
		}
		if len(parsedTypes) > 0 {
			istioConfig.IstioValidations = istioConfig.IstioValidations.FilterByTypes(parsedTypes)
		}
	}

	RespondWithAPIResponse(w, http.StatusOK, istioConfig)
}

func IstioConfigDetails(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	namespace := params["namespace"]
	objectGroup := params["group"]
	objectVersion := params["version"]
	objectKind := params["kind"]
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

	gvk := schema.GroupVersionKind{
		Group:   objectGroup,
		Version: objectVersion,
		Kind:    objectKind,
	}

	if !checkObjectType(gvk) {
		RespondWithError(w, http.StatusBadRequest, "Object type not managed: "+gvk.String())
		return
	}

	// Get business layer
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	istioConfigDetails, err := business.IstioConfig.GetIstioConfigDetails(context.TODO(), cluster, namespace, gvk, object)
	if err != nil {
		handleErrorResponse(w, err)
		return
	}

	istioConfigValidations := models.IstioValidations{}
	istioConfigReferences := models.IstioReferencesMap{}

	validationsResult := make(chan error)
	if includeValidations {
		go func(istioConfigValidations *models.IstioValidations, istioConfigReferences *models.IstioReferencesMap) {
			defer func() {
				close(validationsResult)
			}()
			exportTo := istioConfigDetails.GetExportTo()
			if len(exportTo) != 0 {
				// validations should be done per exported namespaces to apply exportTo configs
				loadedNamespaces, _ := business.Namespace.GetClusterNamespaces(r.Context(), cluster)
				for _, ns := range loadedNamespaces {
					if util.InSlice(exportTo, ns.Name) && ns.Name != namespace {
						istioConfigValidationResults, istioConfigReferencesResults, err := business.Validations.GetIstioObjectValidations(r.Context(), cluster, ns.Name, gvk, object)
						if err != nil {
							validationsResult <- err
						}
						*istioConfigValidations = istioConfigValidations.MergeValidations(istioConfigValidationResults)
						*istioConfigReferences = istioConfigReferencesResults.MergeReferencesMap(istioConfigReferencesResults)
					}
				}
			}
			// also validate own namespace
			istioConfigValidationResults, istioConfigReferencesResults, err := business.Validations.GetIstioObjectValidations(r.Context(), cluster, namespace, gvk, object)
			if err != nil {
				validationsResult <- err
			}
			*istioConfigValidations = istioConfigValidations.MergeValidations(istioConfigValidationResults)
			*istioConfigReferences = istioConfigReferencesResults.MergeReferencesMap(istioConfigReferencesResults)

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

func IstioConfigDelete(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	namespace := params["namespace"]
	objectGroup := params["group"]
	objectVersion := params["version"]
	objectKind := params["kind"]
	object := params["object"]

	query := r.URL.Query()
	cluster := clusterNameFromQuery(query)

	gvk := schema.GroupVersionKind{
		Group:   objectGroup,
		Version: objectVersion,
		Kind:    objectKind,
	}

	if !business.GetIstioAPI(gvk) {
		RespondWithError(w, http.StatusBadRequest, "Object type not managed: "+gvk.String())
		return
	}

	// Get business layer
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}
	err = business.IstioConfig.DeleteIstioConfigDetail(r.Context(), cluster, namespace, gvk, object)
	if err != nil {
		handleErrorResponse(w, err)
		return
	} else {
		audit(r, "DELETE on Namespace: "+namespace+" Type: "+gvk.String()+" Name: "+object)
		RespondWithCode(w, http.StatusOK)
	}
}

func IstioConfigUpdate(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	namespace := params["namespace"]
	objectGroup := params["group"]
	objectVersion := params["version"]
	objectKind := params["kind"]
	object := params["object"]

	query := r.URL.Query()
	cluster := clusterNameFromQuery(query)

	gvk := schema.GroupVersionKind{
		Group:   objectGroup,
		Version: objectVersion,
		Kind:    objectKind,
	}

	if !business.GetIstioAPI(gvk) {
		RespondWithError(w, http.StatusBadRequest, "Object type not managed: "+gvk.String())
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
	updatedConfigDetails, err := business.IstioConfig.UpdateIstioConfigDetail(r.Context(), cluster, namespace, gvk, object, jsonPatch)
	if err != nil {
		handleErrorResponse(w, err)
		return
	}

	audit(r, "UPDATE on Namespace: "+namespace+" Type: "+gvk.String()+" Name: "+object+" Patch: "+jsonPatch)
	RespondWithJSON(w, http.StatusOK, updatedConfigDetails)
}

func IstioConfigCreate(w http.ResponseWriter, r *http.Request) {
	// Feels kinda replicated for multiple functions..
	params := mux.Vars(r)
	namespace := params["namespace"]
	objectGroup := params["group"]
	objectVersion := params["version"]
	objectKind := params["kind"]

	query := r.URL.Query()
	cluster := clusterNameFromQuery(query)

	gvk := schema.GroupVersionKind{
		Group:   objectGroup,
		Version: objectVersion,
		Kind:    objectKind,
	}

	if !business.GetIstioAPI(gvk) {
		RespondWithError(w, http.StatusBadRequest, "Object type not managed: "+gvk.String())
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

	createdConfigDetails, err := business.IstioConfig.CreateIstioConfigDetail(r.Context(), cluster, namespace, gvk, body)
	if err != nil {
		handleErrorResponse(w, err)
		return
	}

	audit(r, "CREATE on Namespace: "+namespace+" Type: "+gvk.String()+" Object: "+string(body))
	RespondWithJSON(w, http.StatusOK, createdConfigDetails)
}

func checkObjectType(gvk schema.GroupVersionKind) bool {
	return business.GetIstioAPI(gvk)
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
