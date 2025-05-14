package handlers

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"strings"

	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/handlers/authentication"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/tracing"
)

type promClientSupplier func() (*prometheus.Client, error)

const defaultPatchType = "merge"

var DefaultPromClientSupplier = prometheus.NewClient

func checkNamespaceAccess(ctx context.Context, nsServ business.NamespaceService, namespace string, cluster string) (*models.Namespace, error) {
	return nsServ.GetClusterNamespace(ctx, namespace, cluster)
}

// createMetricsServiceForNamespaceMC is used when the service will query across all clusters for the namespace.
// It will return an error if the user does not have access to the namespace on all of the clusters.
func createMetricsServiceForNamespaceMC(w http.ResponseWriter, r *http.Request, promSupplier promClientSupplier, nsName string) (*business.MetricsService, []models.Namespace) {
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
	var nsInfo []models.Namespace

	for _, cluster := range layer.Namespace.GetClusterList() {
		ns, err2 := checkNamespaceAccess(r.Context(), layer.Namespace, nsName, cluster)
		if err2 != nil {
			if strings.Contains(err2.Error(), "not found") {
				continue
			}
			RespondWithError(w, http.StatusForbidden, "Cannot access namespace data: "+err2.Error())
			return nil, nil
		}
		nsInfo = append(nsInfo, *ns)
	}

	metrics := business.NewMetricsService(prom, config.Get())

	return metrics, nsInfo
}

// createMetricsServiceForClusterMC is used when the service will query across provided namespaces of given cluster.
// It will return an error if the user does not have access to the namespace the given the cluster.
func createMetricsServiceForClusterMC(w http.ResponseWriter, r *http.Request, promSupplier promClientSupplier, cluster string, nss []string) (*business.MetricsService, []models.Namespace) {
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
	var nsInfo []models.Namespace

	for _, nsName := range nss {
		ns, err2 := checkNamespaceAccess(r.Context(), layer.Namespace, nsName, cluster)
		if err2 != nil {
			if strings.Contains(err2.Error(), "not found") {
				continue
			}
			RespondWithError(w, http.StatusForbidden, "Cannot access namespace data: "+err2.Error())
			return nil, nil
		}
		nsInfo = append(nsInfo, *ns)
	}

	metrics := business.NewMetricsService(prom, config.Get())

	return metrics, nsInfo
}

// GetOldestNamespace is a convenience function that takes a list of Namespaces and returns the
// Namespace with the oldest CreationTimestamp.  In a tie, preference is towards the head of the list.
func GetOldestNamespace(namespaces []models.Namespace) *models.Namespace {
	var oldestNamespace *models.Namespace
	for i, ns := range namespaces {
		if i == 0 || ns.CreationTimestamp.Before(oldestNamespace.CreationTimestamp) {
			oldestNamespace = &ns
		}
	}
	return oldestNamespace
}

func createMetricsServiceForNamespace(w http.ResponseWriter, r *http.Request, promSupplier promClientSupplier, ns models.Namespace) (*business.MetricsService, *models.Namespace) {
	metrics, infoMap := createMetricsServiceForNamespaces(w, r, promSupplier, []models.Namespace{ns})
	if result, ok := infoMap[ns.Name]; ok {
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

func createMetricsServiceForNamespaces(w http.ResponseWriter, r *http.Request, promSupplier promClientSupplier, namespaces []models.Namespace) (*business.MetricsService, map[string]nsInfoError) {
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
		info, err := checkNamespaceAccess(r.Context(), layer.Namespace, ns.Name, ns.Cluster)
		nsInfos[ns.Name] = nsInfoError{info: info, err: err}
	}
	metrics := business.NewMetricsService(prom, config.Get())
	return metrics, nsInfos
}

func getUserClients(r *http.Request, cf kubernetes.ClientFactory) (map[string]kubernetes.UserClientInterface, error) {
	authInfos, err := getAuthInfo(r)
	if err != nil {
		return nil, err
	}

	return cf.GetClients(authInfos)
}

// getAuthInfo retrieves the token from the request's context
func getAuthInfo(r *http.Request) (map[string]*api.AuthInfo, error) {
	authInfoContext := authentication.GetAuthInfoContext(r.Context())
	if authInfoContext != nil {
		if authInfo, ok := authInfoContext.(map[string]*api.AuthInfo); ok {
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
func clusterNameFromQuery(conf *config.Config, queryParams url.Values) string {
	cluster := queryParams.Get("clusterName")
	if cluster == "" {
		cluster = conf.KubernetesConfig.ClusterName
	}
	return cluster
}

func getLayer(
	r *http.Request,
	conf *config.Config,
	kialiCache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	cpm business.ControlPlaneMonitor,
	prom prometheus.ClientInterface,
	traceClientLoader func() tracing.ClientInterface,
	grafana *grafana.Service,
	discovery istio.MeshDiscovery,
) (*business.Layer, error) {
	authInfo, err := getAuthInfo(r)
	if err != nil {
		return nil, err
	}

	layer, err := business.NewLayer(conf, kialiCache, clientFactory, prom, traceClientLoader(), cpm, grafana, discovery, authInfo)
	if err != nil {
		return nil, err
	}

	return layer, nil
}
