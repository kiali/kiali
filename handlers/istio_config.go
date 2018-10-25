package handlers

import (
	"net/http"
	"strings"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/log"
	"k8s.io/apimachinery/pkg/api/errors"
)

func IstioConfigList(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	namespace := params["namespace"]
	query := r.URL.Query()
	objects := ""
	if _, ok := query["objects"]; ok {
		objects = strings.ToLower(query.Get("objects"))
	}
	criteria := parseCriteria(namespace, objects)

	// Get business layer
	business, err := business.Get()
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	istioConfig, err := business.IstioConfig.GetIstioConfigList(criteria)
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, istioConfig)
}

func checkType(types []string, name string) bool {
	for _, typeName := range types {
		if typeName == name {
			return true
		}
	}
	return false
}

func parseCriteria(namespace string, objects string) business.IstioConfigCriteria {
	defaultInclude := objects == ""
	criteria := business.IstioConfigCriteria{}
	criteria.Namespace = namespace
	criteria.IncludeGateways = defaultInclude
	criteria.IncludeVirtualServices = defaultInclude
	criteria.IncludeDestinationRules = defaultInclude
	criteria.IncludeServiceEntries = defaultInclude
	criteria.IncludeRules = defaultInclude
	criteria.IncludeQuotaSpecs = defaultInclude
	criteria.IncludeQuotaSpecBindings = defaultInclude

	if defaultInclude {
		return criteria
	}

	types := strings.Split(objects, ",")
	if checkType(types, "gateways") {
		criteria.IncludeGateways = true
	}
	if checkType(types, "virtualservices") {
		criteria.IncludeVirtualServices = true
	}
	if checkType(types, "destinationrules") {
		criteria.IncludeDestinationRules = true
	}
	if checkType(types, "serviceentries") {
		criteria.IncludeServiceEntries = true
	}
	if checkType(types, "rules") {
		criteria.IncludeRules = true
	}
	if checkType(types, "quotaspecs") {
		criteria.IncludeQuotaSpecs = true
	}
	if checkType(types, "quotaspecbindings") {
		criteria.IncludeQuotaSpecBindings = true
	}
	return criteria
}

func IstioConfigDetails(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	namespace := params["namespace"]
	objectType := params["object_type"]
	object := params["object"]

	if !checkObjectType(objectType) {
		RespondWithError(w, http.StatusBadRequest, "Object type not managed: "+objectType)
		return
	}

	// Get business layer
	business, err := business.Get()
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	istioConfigDetails, err := business.IstioConfig.GetIstioConfigDetails(namespace, objectType, object)
	if errors.IsNotFound(err) {
		RespondWithError(w, http.StatusNotFound, err.Error())
		return
	} else if statusError, isStatus := err.(*errors.StatusError); isStatus {
		RespondWithError(w, http.StatusInternalServerError, statusError.ErrStatus.Message)
		return
	} else if err != nil {
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, istioConfigDetails)
}

func IstioConfigDelete(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	namespace := params["namespace"]
	objectType := params["object_type"]
	object := params["object"]

	api := business.GetIstioAPI(objectType)
	if api == "" {
		RespondWithError(w, http.StatusBadRequest, "Object type not managed: "+objectType)
		return
	}

	// Get business layer
	business, err := business.Get()
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	err = business.IstioConfig.DeleteIstioConfigDetail(api, namespace, objectType, object)
	if err != nil {
		log.Error(err)
		if errors.IsNotFound(err) {
			RespondWithError(w, http.StatusNotFound, err.Error())
		} else {
			RespondWithError(w, http.StatusInternalServerError, err.Error())
		}
	} else {
		RespondWithJSON(w, http.StatusOK, "Deleted")
	}
	return
}

func IstioConfigValidations(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	namespace := params["namespace"]
	objectType := params["object_type"]
	object := params["object"]

	if !checkObjectType(objectType) {
		RespondWithError(w, http.StatusBadRequest, "Object type not managed: "+objectType)
		return
	}

	// Get business layer
	business, err := business.Get()
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	istioConfigValidations, err := business.Validations.GetIstioObjectValidations(namespace, objectType, object)
	if errors.IsNotFound(err) {
		RespondWithError(w, http.StatusNotFound, err.Error())
		return
	} else if statusError, isStatus := err.(*errors.StatusError); isStatus {
		RespondWithError(w, http.StatusInternalServerError, statusError.ErrStatus.Message)
		return
	} else if err != nil {
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, istioConfigValidations)
}

func checkObjectType(objectType string) bool {
	return business.GetIstioAPI(objectType) != ""
}
