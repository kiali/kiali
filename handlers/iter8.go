package handlers

import (
	"io/ioutil"
	"net/http"
	"strings"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/config"
)

func Iter8Status(w http.ResponseWriter, r *http.Request) {
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}
	iter8Info := business.Iter8.GetIter8Info()
	RespondWithJSON(w, http.StatusOK, iter8Info)
}

func Iter8Experiments(w http.ResponseWriter, r *http.Request) {
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}
	params := r.URL.Query()
	namespaces := params.Get("namespaces") // csl of namespaces
	ns := strings.Split(namespaces, ",")
	experiments, err := business.Iter8.GetIter8Experiments(ns)
	if err != nil {
		handleErrorResponse(w, err)
		return
	}
	RespondWithJSON(w, http.StatusOK, experiments)
}

func Iter8ExperimentGetYaml(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	business, err := getBusiness(r)
	namespace := params["namespace"]
	name := params["name"]
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}
	yamlSpec, err := business.Iter8.GetIter8ExperimentYaml(namespace, name)
	if err != nil {
		handleErrorResponse(w, err)
		return
	}
	RespondWithJSON(w, http.StatusOK, yamlSpec)
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
	experiment, err := business.Iter8.GetIter8Experiment(namespace, name)
	if err != nil {
		handleErrorResponse(w, err)
		return
	}
	if experiment.ExperimentItem.Kind == "Deployment" {
		workloadList, err := business.Workload.GetWorkloadList(namespace)
		if err != nil {
			handleErrorResponse(w, err)
			return
		}
		for _, w := range workloadList.Workloads {
			conf := config.Get()
			if w.Name == experiment.ExperimentItem.Baseline.Name {
				experiment.ExperimentItem.Baseline.Version = w.Labels[conf.IstioLabels.VersionLabelName]
			} else {
				for _, c := range experiment.ExperimentItem.Candidates {
					if w.Name == c.Name {
						c.Version = w.Labels[conf.IstioLabels.VersionLabelName]
					}
				}

			}
		}
	} else {
		serviceList, err := business.Svc.GetServiceList(namespace)
		if err != nil {
			handleErrorResponse(w, err)
			return
		}
		for _, s := range serviceList.Services {
			conf := config.Get()
			if s.Name == experiment.ExperimentItem.Baseline.Name {
				experiment.ExperimentItem.Baseline.Version = s.Labels[conf.IstioLabels.VersionLabelName]
			} else {
				for _, c := range experiment.ExperimentItem.Candidates {
					if s.Name == c.Name {
						c.Version = s.Labels[conf.IstioLabels.VersionLabelName]
					}
				}

			}
		}
	}

	RespondWithJSON(w, http.StatusOK, experiment)
}

func Iter8ExperimentCreate(w http.ResponseWriter, r *http.Request) {
	jsonBody := false
	params := mux.Vars(r)
	queryParams := r.URL.Query()
	if json := queryParams.Get("type"); json == "json" {
		jsonBody = true
	}
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}
	namespace := params["namespace"]
	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}
	experiment, err := business.Iter8.CreateIter8Experiment(namespace, body, jsonBody)
	if err != nil {
		handleErrorResponse(w, err)
		return
	}
	RespondWithJSON(w, http.StatusOK, experiment)
}

func Iter8ExperimentUpdate(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}
	namespace := params["namespace"]
	name := params["name"]
	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	experiment, err := business.Iter8.UpdateIter8Experiment(namespace, name, body)
	if err != nil {
		handleErrorResponse(w, err)
		return
	}
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
	err = business.Iter8.DeleteIter8Experiment(namespace, name)
	if err != nil {
		handleErrorResponse(w, err)
		return
	}
	RespondWithCode(w, http.StatusOK)
}

func Iter8Metrics(w http.ResponseWriter, r *http.Request) {

	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}
	metricNames, err := business.Iter8.GetIter8Metrics()
	if err != nil {
		handleErrorResponse(w, err)
		return
	}
	RespondWithJSON(w, http.StatusOK, metricNames)
}
