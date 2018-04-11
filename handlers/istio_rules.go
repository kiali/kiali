package handlers

import (
	"net/http"

	"github.com/gorilla/mux"
	"k8s.io/apimachinery/pkg/api/errors"

	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/services/models"
)

func IstioRuleList(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	namespace := models.Namespace{Name: params["namespace"]}

	istioRules, err := models.GetIstioRulesByNamespace(namespace.Name)
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, models.IstioRuleList{Namespace: namespace, Rules: istioRules})
}

func IstioRuleDetails(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	namespace := models.Namespace{Name: params["namespace"]}
	rule := params["rule"]

	istioRuleDetails, err := models.GetIstioRuleDetails(namespace.Name, rule)
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
	istioRuleDetails.Namespace = namespace
	RespondWithJSON(w, http.StatusOK, istioRuleDetails)
}
