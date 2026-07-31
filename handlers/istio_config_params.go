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

var istioConfigListQueryParams = []queryparams.Param{
	queryparams.PresenceParam("_"),
	queryparams.ClusterParam(),
	queryparams.StringParam("labelSelector", ""),
	queryparams.StringParam("objects", ""),
	queryparams.BoolParam("validate", false),
	queryparams.StringParam("workloadSelector", ""),
}

func parseIstioConfigListParams(conf *config.Config, query url.Values) (istioConfigListParams, error) {
	result, err := queryparams.ParseWithConfig(query, conf, istioConfigListQueryParams)
	if err != nil {
		return istioConfigListParams{}, err
	}

	includeValidations := result.Bool("validate")
	if !conf.IsValidationsEnabled() {
		includeValidations = false
	}

	return istioConfigListParams{
		ClusterName:        result.Cluster(),
		IncludeValidations: includeValidations,
		LabelSelector:      result.String("labelSelector"),
		Objects:            result.String("objects"),
		WorkloadSelector:   result.String("workloadSelector"),
	}, nil
}

type istioConfigDetailsParams struct {
	ClusterName        string
	IncludeHelp        bool
	IncludeValidations bool
}

var istioConfigDetailsQueryParams = []queryparams.Param{
	queryparams.ClusterParam(),
	queryparams.PresenceParam("help"),
	queryparams.BoolParam("validate", false),
}

func parseIstioConfigDetailsParams(conf *config.Config, query url.Values) (istioConfigDetailsParams, error) {
	result, err := queryparams.ParseWithConfig(query, conf, istioConfigDetailsQueryParams)
	if err != nil {
		return istioConfigDetailsParams{}, err
	}

	includeValidations := result.Bool("validate")
	if !conf.IsValidationsEnabled() {
		includeValidations = false
	}

	_, includeHelp := query["help"]
	return istioConfigDetailsParams{
		ClusterName:        result.Cluster(),
		IncludeHelp:        includeHelp,
		IncludeValidations: includeValidations,
	}, nil
}

var istioConfigClusterQueryParams = []queryparams.Param{
	queryparams.ClusterParam(),
}

func parseIstioConfigClusterParams(conf *config.Config, query url.Values) (string, error) {
	result, err := queryparams.ParseWithConfig(query, conf, istioConfigClusterQueryParams)
	if err != nil {
		return "", err
	}
	return result.Cluster(), nil
}

var istioConfigNamespacesQueryParams = []queryparams.Param{
	queryparams.ClusterParam(),
	queryparams.StringParam("namespaces", ""),
}

func parseIstioConfigNamespacesParams(conf *config.Config, query url.Values) (cluster, namespaces string, err error) {
	result, err := queryparams.ParseWithConfig(query, conf, istioConfigNamespacesQueryParams)
	if err != nil {
		return "", "", err
	}
	return result.Cluster(), result.String("namespaces"), nil
}

func respondQueryParamError(w http.ResponseWriter, err error) bool {
	if err == nil {
		return false
	}
	RespondWithQueryParamError(w, err.Error())
	return true
}
