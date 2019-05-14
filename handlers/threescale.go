package handlers

import (
	"github.com/gorilla/mux"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"io/ioutil"
	"k8s.io/apimachinery/pkg/api/errors"
	"net/http"

	"github.com/kiali/kiali/log"
)

func ThreeScaleStatus(w http.ResponseWriter, r *http.Request) {
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	threeScaleInfo, err := business.ThreeScale.GetThreeScaleInfo()
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, threeScaleInfo)
}

func ThreeScaleHandlersList(w http.ResponseWriter, r *http.Request) {
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	// threeScaleHandlers, err := business.ThreeScale
	threeScaleHandlers, err := business.ThreeScale.GetThreeScaleHandlers()
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, threeScaleHandlers)
}

func ThreeScaleHandlersCreate(w http.ResponseWriter, r *http.Request) {
	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, "Create request could not be read: "+err.Error())
	}

	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	threeScaleHandlers, err := business.ThreeScale.CreateThreeScaleHandler(body)
	if err != nil {
		if err.Error() == models.BadThreeScaleHandlerJson {
			RespondWithError(w, http.StatusBadRequest, err.Error())
		} else {
			RespondWithError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	conf := config.Get()
	audit(r, "CREATE on Namespace: "+conf.IstioNamespace+" ThreeScale Adapter. Json: "+string(body))

	RespondWithJSON(w, http.StatusOK, threeScaleHandlers)
}

func ThreeScaleHandlersUpdate(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	threescaleHandlerName := params["threescaleHandlerName"]

	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, "Update request with bad update patch: "+err.Error())
	}

	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	threeScaleHandlers, err := business.ThreeScale.UpdateThreeScaleHandler(threescaleHandlerName, body)
	if err != nil {
		log.Error(err)
		if errors.IsNotFound(err) {
			RespondWithError(w, http.StatusNotFound, err.Error())
		} else {
			RespondWithError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	conf := config.Get()
	audit(r, "UPDATE on Namespace: "+conf.IstioNamespace+" ThreeScale Adapter Name: "+threescaleHandlerName)

	RespondWithJSON(w, http.StatusOK, threeScaleHandlers)
}

func ThreeScaleHandlersDelete(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	threescaleHandlerName := params["threescaleHandlerName"]

	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	threeScaleHandlers, err := business.ThreeScale.DeleteThreeScaleHandler(threescaleHandlerName)
	if err != nil {
		log.Error(err)
		if errors.IsNotFound(err) {
			RespondWithError(w, http.StatusNotFound, err.Error())
		} else {
			RespondWithError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	conf := config.Get()
	audit(r, "DELETE on Namespace: "+conf.IstioNamespace+" ThreeScale Adapter Name: "+threescaleHandlerName)

	RespondWithJSON(w, http.StatusOK, threeScaleHandlers)
}

func ThreeScaleServiceRuleGet(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	namespace := params["namespace"]
	service := params["service"]

	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	threeScaleRule, err := business.ThreeScale.GetThreeScaleRule(namespace, service)
	if err != nil {
		log.Error(err)
		if errors.IsNotFound(err) {
			RespondWithError(w, http.StatusNotFound, err.Error())
		} else {
			RespondWithError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	RespondWithJSON(w, http.StatusOK, threeScaleRule)
}

func ThreeScaleServiceRuleCreate(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	namespace := params["namespace"]

	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, "Create request could not be read: "+err.Error())
	}

	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	threeScaleRule, err := business.ThreeScale.CreateThreeScaleRule(namespace, body)
	if err != nil {
		if err.Error() == models.BadThreeScaleRuleJson {
			RespondWithError(w, http.StatusBadRequest, err.Error())
		} else {
			RespondWithError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	conf := config.Get()
	audit(r, "CREATE on Namespace: "+conf.IstioNamespace+" ThreeScale Rule Name: threescale-"+namespace+"-"+threeScaleRule.ServiceName)

	RespondWithJSON(w, http.StatusOK, threeScaleRule)
}

func ThreeScaleServiceRuleUpdate(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	namespace := params["namespace"]
	service := params["service"]

	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, "Create request could not be read: "+err.Error())
	}

	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	threeScaleRule, err := business.ThreeScale.UpdateThreeScaleRule(namespace, service, body)
	if err != nil {
		if err.Error() == models.BadThreeScaleRuleJson {
			RespondWithError(w, http.StatusBadRequest, err.Error())
		} else {
			RespondWithError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	conf := config.Get()
	audit(r, "UPDATE on Namespace: "+conf.IstioNamespace+" ThreeScale Rule Name: threescale-"+namespace+"-"+service)

	RespondWithJSON(w, http.StatusOK, threeScaleRule)
}

func ThreeScaleServiceRuleDelete(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	namespace := params["namespace"]
	service := params["service"]

	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	err = business.ThreeScale.DeleteThreeScaleRule(namespace, service)
	if err != nil {
		log.Error(err)
		if errors.IsNotFound(err) {
			RespondWithError(w, http.StatusNotFound, err.Error())
		} else {
			RespondWithError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	conf := config.Get()
	audit(r, "DELETE on Namespace: "+conf.IstioNamespace+" ThreeScale Rule Name: threescale-"+namespace+"-"+service)

	RespondWithCode(w, http.StatusOK)
}
