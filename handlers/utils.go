package handlers

import (
	"errors"
	"net/http"
	"net/url"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
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

const defaultPatchType = "merge"

// checkNamespaceAccess is used when the service will query across all clusters for the namespace.
// It will return an error if the user does not have access to the namespace on all of the clusters.
func checkNamespaceAccess(
	w http.ResponseWriter,
	r *http.Request,
	conf *config.Config,
	cache cache.KialiCache,
	discovery istio.MeshDiscovery,
	clientFactory kubernetes.ClientFactory,
	namespace string,
	cluster string,
) (*models.Namespace, error) {
	userClients, err := getUserClients(r, clientFactory)
	if err != nil {
		log.Errorf("Unable to create user clients from token: %s", err)
		RespondWithError(w, http.StatusInternalServerError, "An error occurred while attempting to use your session token. Check your session token and the Kiali server logs.")
		return nil, err
	}

	namespaceService := business.NewNamespaceService(cache, conf, discovery, clientFactory.GetSAClients(), userClients)
	return checkNamespaceAccessWithService(w, r, &namespaceService, namespace, cluster)
}

// checkNamespaceAccessWithService is used when the service will query across all clusters for the namespace.
// It will return an error if the user does not have access to the namespace on all of the clusters.
func checkNamespaceAccessWithService(
	w http.ResponseWriter,
	r *http.Request,
	namespaceService *business.NamespaceService,
	namespace string,
	cluster string,
) (*models.Namespace, error) {
	ns, err := namespaceService.GetClusterNamespace(r.Context(), namespace, cluster)
	if err != nil {
		RespondWithError(w, http.StatusForbidden, "Cannot access namespace data: "+err.Error())
		return nil, err
	}

	return ns, nil
}

// checkNamespaceAccessMultiCluster is used when the service will query across all clusters for the namespace.
// It will return an error if the user does not have access to the namespace on all of the clusters.
func checkNamespaceAccessMultiCluster(
	w http.ResponseWriter,
	r *http.Request,
	conf *config.Config,
	cache cache.KialiCache,
	discovery istio.MeshDiscovery,
	clientFactory kubernetes.ClientFactory,
	namespace string,
) ([]models.Namespace, error) {
	var nsInfo []models.Namespace
	userClients, err := getUserClients(r, clientFactory)
	if err != nil {
		log.Errorf("Unable to create user clients from token: %s", err)
		RespondWithError(w, http.StatusInternalServerError, "An error occurred while attempting to use your session token. Check your session token and the Kiali server logs.")
		return nil, err
	}

	namespaceService := business.NewNamespaceService(cache, conf, discovery, clientFactory.GetSAClients(), userClients)

	for _, cluster := range namespaceService.GetClusterList() {
		ns, err := checkNamespaceAccessWithService(w, r, &namespaceService, namespace, cluster)
		if err != nil {
			if k8serrors.IsNotFound(err) {
				continue
			}
			RespondWithError(w, http.StatusForbidden, "Cannot access namespace data: "+err.Error())
			return nil, nil
		}
		nsInfo = append(nsInfo, *ns)
	}

	return nsInfo, nil
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
			return nil, errors.New("authInfo is not of type map[string]*api.AuthInfo")
		}
	} else {
		return nil, errors.New("authInfo missing from the request context")
	}
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
