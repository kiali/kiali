package handlers

import (
    "net/http"
    "strings"

    "github.com/gorilla/mux"

    "github.com/kiali/kiali/log"
    "github.com/kiali/kiali/services/business"
    "k8s.io/apimachinery/pkg/api/errors"
)

func IstioConfigList(w http.ResponseWriter, r *http.Request) {
    criteria := parseListParams(r)

    // Get business layer
    business, err := business.Get()
    if err != nil {
        RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
        return
    }

    istioConfig, err := business.IstioConfig.GetIstioConfig(criteria)
    if err != nil {
        log.Error(err)
        RespondWithError(w, http.StatusInternalServerError, err.Error())
        return
    }

    RespondWithJSON(w, http.StatusOK, istioConfig)
}

func parseListParams(r *http.Request) business.IstioConfigCriteria {
    criteria := business.IstioConfigCriteria{}
    params := mux.Vars(r)
    criteria.Namespace = params["namespace"]
    criteria.IncludeRouteRules = false
    criteria.IncludeDestinationPolicies= false
    criteria.IncludeVirtualServices = false
    criteria.IncludeDestinationRules = false
    criteria.IncludeRules = false

    query := r.URL.Query()
    const all = "_all_"
    csl := all
    _, ok := query["objects"]
    if ok {
        csl = strings.ToLower(query.Get("objects"))
    }

    if csl == all || strings.Contains(csl, "routerules") {
        criteria.IncludeRouteRules = true
    }
    if csl == all || strings.Contains(csl, "destinationpolicies") {
        criteria.IncludeDestinationPolicies = true
    }
    if csl == all || strings.Contains(csl, "virtualservices") {
        criteria.IncludeVirtualServices = true
    }
    if csl == all || strings.Contains(csl, "destinationrules") {
        criteria.IncludeDestinationRules = true
    }
    if csl == all || strings.Contains(csl, "rules") {
        criteria.IncludeRules = true
    }
    return criteria
}

func IstioConfigDetails(w http.ResponseWriter, r *http.Request) {
    params := mux.Vars(r)
    namespace := params["namespace"]
    objectType := params["object_type"]
    object := params["object"]

    if !checkObjectType(objectType) {
        RespondWithError(w, http.StatusBadRequest, "Object type not found: "+ objectType)
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

func checkObjectType(objectType string) bool {
    switch objectType {
    case
        "routerules",
        "destinationpolicies",
        "virtualservices",
        "destinationrules",
        "rules":
            return true
    }
    return false
}
