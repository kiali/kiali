package handlers

import (
	"net/http"
	"net/url"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/handlers/queryparams"
)

type istioConfigListParams struct {
	ClusterName        string
	IncludeValidations bool
	LabelSelector      string
	Objects            string
	WorkloadSelector   string
}

func parseIstioConfigListParams(conf *config.Config, query url.Values) (istioConfigListParams, error) {
	if err := queryparams.RejectUnknown(query, "clusterName", "labelSelector", "objects", "validate", "workloadSelector"); err != nil {
		return istioConfigListParams{}, err
	}

	includeValidations, err := queryparams.ParseBoolParam(query.Get("validate"), "validate", false)
	if err != nil {
		return istioConfigListParams{}, err
	}
	if !conf.IsValidationsEnabled() {
		includeValidations = false
	}

	return istioConfigListParams{
		ClusterName:        queryparams.ClusterName(conf, query),
		IncludeValidations: includeValidations,
		LabelSelector:      query.Get("labelSelector"),
		Objects:            query.Get("objects"),
		WorkloadSelector:   query.Get("workloadSelector"),
	}, nil
}

type istioConfigDetailsParams struct {
	ClusterName        string
	IncludeHelp        bool
	IncludeValidations bool
}

func parseIstioConfigDetailsParams(conf *config.Config, query url.Values) (istioConfigDetailsParams, error) {
	if err := queryparams.RejectUnknown(query, "clusterName", "help", "validate"); err != nil {
		return istioConfigDetailsParams{}, err
	}

	includeValidations, err := queryparams.ParseBoolParam(query.Get("validate"), "validate", false)
	if err != nil {
		return istioConfigDetailsParams{}, err
	}
	if !conf.IsValidationsEnabled() {
		includeValidations = false
	}

	_, includeHelp := query["help"]
	return istioConfigDetailsParams{
		ClusterName:        queryparams.ClusterName(conf, query),
		IncludeHelp:        includeHelp,
		IncludeValidations: includeValidations,
	}, nil
}

func parseIstioConfigClusterParams(conf *config.Config, query url.Values) (string, error) {
	if err := queryparams.RejectUnknown(query, "clusterName"); err != nil {
		return "", err
	}
	return queryparams.ClusterName(conf, query), nil
}

func parseIstioConfigNamespacesParams(conf *config.Config, query url.Values) (cluster, namespaces string, err error) {
	if err := queryparams.RejectUnknown(query, "clusterName", "namespaces"); err != nil {
		return "", "", err
	}
	return queryparams.ClusterName(conf, query), query.Get("namespaces"), nil
}

func respondQueryParamError(w http.ResponseWriter, err error) bool {
	if err == nil {
		return false
	}
	RespondWithQueryParamError(w, err.Error())
	return true
}
