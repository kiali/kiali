package handlers

import (
	"context"
	"errors"
	"net/http"
	"slices"
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

const defaultPatchType = "merge"

// respondNamespaceAccessError writes 403 for an access denial and 500 when
// the accessible set could not be computed (fail closed). It is the single
// mapping used by every namespace gate so the status text cannot diverge
// between endpoints.
func respondNamespaceAccessError(w http.ResponseWriter, err error) {
	if business.IsAccessibleError(err) {
		RespondWithError(w, http.StatusForbidden, "Cannot access namespace data: "+err.Error())
		return
	}
	RespondWithError(w, http.StatusInternalServerError, "Error fetching namespaces: "+err.Error())
}

// respondNamespaceNotAccessible writes the 403 for a namespace that is not
// in the accessible set (used where there is no error value to wrap).
func respondNamespaceNotAccessible(w http.ResponseWriter, namespace string) {
	RespondWithError(w, http.StatusForbidden, "Cannot access namespace data: namespace ["+namespace+"] is not accessible")
}

// namespaceServiceForRequest builds the request user's NamespaceService,
// writing the 500 and returning nil if the user clients cannot be created.
func namespaceServiceForRequest(
	w http.ResponseWriter,
	r *http.Request,
	conf *config.Config,
	kialiCache cache.KialiCache,
	discovery istio.MeshDiscovery,
	clientFactory kubernetes.ClientFactory,
) *business.NamespaceService {
	userClients, err := getUserClients(r, clientFactory)
	if err != nil {
		log.Errorf("Unable to create user clients from token: %s", err)
		RespondWithError(w, http.StatusInternalServerError, "An error occurred while attempting to use your session token. Check your session token and the Kiali server logs.")
		return nil
	}
	ns := business.NewNamespaceService(kialiCache, conf, discovery, clientFactory.GetSAClients(), userClients)
	return &ns
}

// checkNamespaceAccessOn is the core of the canonical namespace gate: it
// authorizes the user for the given namespace against their accessible set
// via the given NamespaceService (GetClusterNamespace, which is resolved from
// the namespace LIST — or from per-namespace GETs when require_namespace_get
// is enabled — and cached per token). It returns the namespace metadata
// (callers need CreationTimestamp for rate-interval bounding) or an error,
// with the error response already written: 403 when the namespace is not in
// the accessible set, 500 when the set cannot be computed (fail closed).
func checkNamespaceAccessOn(
	w http.ResponseWriter,
	r *http.Request,
	namespaceService *business.NamespaceService,
	namespace string,
	cluster string,
) (*models.Namespace, error) {
	ns, err := namespaceService.GetClusterNamespace(r.Context(), namespace, cluster)
	if err != nil {
		respondNamespaceAccessError(w, err)
		return nil, err
	}
	return ns, nil
}

// checkNamespaceAccessWithList is the canonical handler gate for handlers
// that do not already hold a business layer: it builds the request's
// NamespaceService and applies checkNamespaceAccessOn. Handlers that already
// built a layer can pass its Namespace service to checkNamespaceAccessOn
// directly.
func checkNamespaceAccessWithList(
	w http.ResponseWriter,
	r *http.Request,
	conf *config.Config,
	kialiCache cache.KialiCache,
	discovery istio.MeshDiscovery,
	clientFactory kubernetes.ClientFactory,
	namespace string,
	cluster string,
) (*models.Namespace, error) {
	namespaceService := namespaceServiceForRequest(w, r, conf, kialiCache, discovery, clientFactory)
	if namespaceService == nil {
		return nil, errors.New("unable to create user clients")
	}
	return checkNamespaceAccessOn(w, r, namespaceService, namespace, cluster)
}

// checkNamespaceAccessAllSAClusters authorizes the user for the given
// namespace across every SA-visible cluster (see
// NamespaceService.CheckNamespaceAccessAllClusters). Use it for handlers
// whose underlying query is not cluster-scoped (e.g. Prometheus queries
// built without a cluster label) — for those, a cluster the user cannot see
// must deny the request rather than be skipped, or that cluster's data
// would be served. It returns the namespace entries from the clusters where
// it is accessible. It writes 403 when denied, 500 on home-cluster errors,
// and 404 when absentIsNotFound is set and the namespace exists in no
// cluster.
func checkNamespaceAccessAllSAClusters(
	w http.ResponseWriter,
	r *http.Request,
	conf *config.Config,
	kialiCache cache.KialiCache,
	discovery istio.MeshDiscovery,
	clientFactory kubernetes.ClientFactory,
	namespace string,
	absentIsNotFound bool,
) ([]models.Namespace, error) {
	namespaceService := namespaceServiceForRequest(w, r, conf, kialiCache, discovery, clientFactory)
	if namespaceService == nil {
		return nil, errors.New("unable to create user clients")
	}

	accessible, err := namespaceService.CheckNamespaceAccessAllClusters(r.Context(), namespace)
	if err != nil {
		respondNamespaceAccessError(w, err)
		return nil, err
	}

	if len(accessible) == 0 && absentIsNotFound {
		RespondWithError(w, http.StatusNotFound, "Namespace ["+namespace+"] was not found in any cluster")
		return nil, nil
	}

	return accessible, nil
}

// accessibleNamespaceNames returns the user's accessible namespace names for
// the cluster, narrowed to namespacesParam (a comma-separated list) when it
// is set. It writes a 500 and returns false if the accessible set cannot be
// computed (fail closed).
func accessibleNamespaceNames(w http.ResponseWriter, ctx context.Context, layer *business.Layer, cluster, namespacesParam string) ([]string, bool) {
	accessible, err := layer.Namespace.GetClusterNamespaces(ctx, cluster)
	if err != nil {
		// Fail closed: if the accessible set cannot be determined, reject
		// rather than return an empty (200) result set.
		RespondWithError(w, http.StatusInternalServerError, "Error fetching namespaces: "+err.Error())
		return nil, false
	}

	names := make([]string, 0, len(accessible))
	if namespacesParam == "" {
		for _, ns := range accessible {
			names = append(names, ns.Name)
		}
		return names, true
	}

	requested := strings.Split(namespacesParam, ",")
	for _, ns := range accessible {
		if slices.Contains(requested, ns.Name) {
			names = append(names, ns.Name)
		}
	}
	return names, true
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
