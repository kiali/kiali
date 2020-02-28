package handlers

import (
	"github.com/gorilla/mux"
	"github.com/kiali/kiali/models"
	"io/ioutil"
	"net/http"
	"strings"

	"github.com/kiali/kiali/log"
)

func Iter8Status(w http.ResponseWriter, r *http.Request) {
	business, err := getBusiness(r)

	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	iter8Info, err := business.Iter8.GetIter8Info()
	if err != nil {
		handleErrorResponse(w, err)
	}

	RespondWithJSON(w, http.StatusOK, iter8Info)
}
func Iter8Experiments(w http.ResponseWriter, r *http.Request) {

	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}
	experimentlists := []models.ExperimentListItem{}
	params := r.URL.Query()
	namespaces := params.Get("namespaces") // csl of namespaces
	if len(namespaces) > 0 {
		ns := strings.Split(namespaces, ",")
		experimentlists, err = business.Iter8.GetIter8Experiments(ns)
	} else {
		ns := []string{}
		experimentlists, err = business.Iter8.GetIter8Experiments(ns)
	}
	RespondWithJSON(w, http.StatusOK, experimentlists)

}

func Iter8ExperimentGet(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	business, err := getBusiness(r)
	namespace := params["namespace"]
	name := params["name"]
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}
	log.Infof("Calling get etIter8Experiment with Namespace %s, and name %s ", namespace, name)
	experiment, err := business.Iter8.GetIter8Experiment(namespace, name)
	RespondWithJSON(w, http.StatusOK, experiment)
}

func Iter8ExperimentCreate(w http.ResponseWriter, r *http.Request) {
	business, err := getBusiness(r)
	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	experiment, err := business.Iter8.Iter8ExperimentCreate(body)
	RespondWithJSON(w, http.StatusOK, experiment)
}

func Iter8ExperimentUpdate(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	business, err := getBusiness(r)
	namespace := params["namespace"]
	name := params["name"]
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	experiment, err := business.Iter8.GetIter8Experiment(namespace, name)
	RespondWithJSON(w, http.StatusOK, experiment)
}

func Iter8ExperimentDelete(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	business, err := getBusiness(r)
	namespace := params["namespace"]
	name := params["name"]
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	experiment, err := business.Iter8.GetIter8Experiment(namespace, name)
	RespondWithJSON(w, http.StatusOK, experiment)
}
