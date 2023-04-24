package handlers

import (
	"context"
	"errors"
	"net/http"
	"net/url"

	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/business/authentication"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
)

type promClientSupplier func() (*prometheus.Client, error)

const defaultPatchType = "merge"

var defaultPromClientSupplier = prometheus.NewClient

func checkNamespaceAccess(ctx context.Context, nsServ business.NamespaceService, namespace string) (*models.Namespace, error) {
	return nsServ.GetNamespace(ctx, namespace)
}

func createMetricsServiceForNamespace(w http.ResponseWriter, r *http.Request, promSupplier promClientSupplier, namespace string) (*business.MetricsService, *models.Namespace) {
	metrics, infoMap := createMetricsServiceForNamespaces(w, r, promSupplier, []string{namespace})
	if result, ok := infoMap[namespace]; ok {
		if result.err != nil {
			RespondWithError(w, http.StatusForbidden, "Cannot access namespace data: "+result.err.Error())
			return nil, nil
		}
		return metrics, result.info
	}
	return nil, nil
}

type nsInfoError struct {
	info *models.Namespace
	err  error
}

func createMetricsServiceForNamespaces(w http.ResponseWriter, r *http.Request, promSupplier promClientSupplier, namespaces []string) (*business.MetricsService, map[string]nsInfoError) {
	layer, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return nil, nil
	}
	prom, err := promSupplier()
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusServiceUnavailable, "Prometheus client error: "+err.Error())
		return nil, nil
	}

	nsInfos := make(map[string]nsInfoError)
	for _, ns := range namespaces {
		info, err := checkNamespaceAccess(r.Context(), layer.Namespace, ns)
		nsInfos[ns] = nsInfoError{info: info, err: err}
	}
	metrics := business.NewMetricsService(prom)
	return metrics, nsInfos
}

// getAuthInfo retrieves the token from the request's context
func getAuthInfo(r *http.Request) (*api.AuthInfo, error) {
	authInfoContext := authentication.GetAuthInfoContext(r.Context())
	if authInfoContext != nil {
		if authInfo, ok := authInfoContext.(*api.AuthInfo); ok {
			return authInfo, nil
		} else {
			return nil, errors.New("authInfo is not of type *api.AuthInfo")
		}
	} else {
		return nil, errors.New("authInfo missing from the request context")
	}
}

// getBusiness returns the business layer specific to the users's request
func getBusiness(r *http.Request) (*business.Layer, error) {
	authInfo, err := getAuthInfo(r)
	if err != nil {
		return nil, err
	}

	return business.Get(authInfo)
}

// clusterNameFromQuery extracts the cluster name from the query parameters
// and provides a default value if it's not present.
func clusterNameFromQuery(queryParams url.Values) string {
	cluster := queryParams.Get("cluster")
	if cluster == "" {
		cluster = config.Get().KubernetesConfig.ClusterName
	}
	return cluster
}
