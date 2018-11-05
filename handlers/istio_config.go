package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gorilla/mux"
	"k8s.io/apimachinery/pkg/api/errors"

	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/log"
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
	if checkType(types, business.Gateways) {
		criteria.IncludeGateways = true
	}
	if checkType(types, business.VirtualServices) {
		criteria.IncludeVirtualServices = true
	}
	if checkType(types, business.DestinationRules) {
		criteria.IncludeDestinationRules = true
	}
	if checkType(types, business.ServiceEntries) {
		criteria.IncludeServiceEntries = true
	}
	if checkType(types, business.Rules) {
		criteria.IncludeRules = true
	}
	if checkType(types, business.QuotaSpecs) {
		criteria.IncludeQuotaSpecs = true
	}
	if checkType(types, business.QuotaSpecBindings) {
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

func IstioConfigUpdate(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	namespace := params["namespace"]
	objectType := params["object_type"]
	object := params["object"]

	api := business.GetIstioAPI(objectType)
	if api == "" {
		RespondWithError(w, http.StatusBadRequest, "Object type not managed: "+objectType)
		return
	}

	istioConfigDetails := models.IstioConfigDetails{
		Namespace: models.Namespace{Name: namespace},
		ObjectType: objectType,
	}
	// Check JSON object
	decoder := json.NewDecoder(r.Body)
	switch objectType {
	case business.Gateways:
		var gw models.Gateway
		gw.Name = object
		err := decoder.Decode(&gw)
		if err != nil {
			RespondWithError(w, http.StatusBadRequest, "Bad gateway object: " + err.Error())
			return
		}
		istioConfigDetails.Gateway = &gw
	case business.VirtualServices:
		var vs models.VirtualService
		vs.Name = object
		err := decoder.Decode(&vs)
		if err != nil {
			RespondWithError(w, http.StatusBadRequest, "Bad virtualservice object: " + err.Error())
			return
		}
		istioConfigDetails.VirtualService = &vs
	case business.DestinationRules:
		var dr models.DestinationRule
		dr.Name = object
		err := decoder.Decode(&dr)
		if err != nil {
			RespondWithError(w, http.StatusBadRequest, "Bad destinationrule object: " + err.Error())
			return
		}
		istioConfigDetails.DestinationRule = &dr
	case business.ServiceEntries:
		var se models.ServiceEntry
		se.Name = object
		err := decoder.Decode(&se)
		if err != nil {
			RespondWithError(w, http.StatusBadRequest, "Bad serviceentry object: " + err.Error())
			return
		}
		istioConfigDetails.ServiceEntry = &se
	case business.Rules:
		var ir models.IstioRuleDetails
		ir.Name = object
		err := decoder.Decode(&ir)
		if err != nil {
			RespondWithError(w, http.StatusBadRequest, "Bad istioruledetails object: " + err.Error())
			return
		}
		istioConfigDetails.Rule = &ir
	case business.QuotaSpecs:
		var qs models.QuotaSpec
		qs.Name = object
		err := decoder.Decode(&qs)
		if err != nil {
			RespondWithError(w, http.StatusBadRequest, "Bad quotaspec object: " + err.Error())
			return
		}
		istioConfigDetails.QuotaSpec = &qs
	case business.QuotaSpecBindings:
		var qb models.QuotaSpecBinding
		qb.Name = object
		err := decoder.Decode(&qb)
		if err != nil {
			RespondWithError(w, http.StatusBadRequest, "Bad quotaspecbinding object: " + err.Error())
			return
		}
		istioConfigDetails.QuotaSpecBinding = &qb
	}

	// Get business layer
	business, err := business.Get()
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	updated, err := business.IstioConfig.UpdateIstioConfigDetail(istioConfigDetails)
	if err != nil {
		log.Error(err)
		if errors.IsNotFound(err) {
			RespondWithError(w, http.StatusNotFound, err.Error())
		} else {
			RespondWithError(w, http.StatusInternalServerError, err.Error())
		}
	} else {
		RespondWithJSON(w, http.StatusOK, updated)
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
