package handlers

import (
	"errors"
	"net/http"

	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
)

type promClientSupplier func() (*prometheus.Client, error)

var defaultPromClientSupplier = prometheus.NewClient

func checkNamespaceAccess(nsServ business.NamespaceService, namespace string) (*models.Namespace, error) {
	if nsInfo, err := nsServ.GetNamespace(namespace); err != nil {
		return nil, err
	} else {
		return nsInfo, nil
	}
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
		info, err := checkNamespaceAccess(layer.Namespace, ns)
		nsInfos[ns] = nsInfoError{info: info, err: err}
	}
	metrics := business.NewMetricsService(prom)
	return metrics, nsInfos
}

// getAuthInfo retrieves the token from the request's context
func getAuthInfo(r *http.Request) (*api.AuthInfo, error) {
	authInfoContext := r.Context().Value("authInfo")
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
