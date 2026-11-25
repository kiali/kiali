package business

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"

	"golang.org/x/sync/errgroup"
	"golang.org/x/sync/singleflight"
	core_v1 "k8s.io/api/core/v1"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/observability"
	"github.com/kiali/kiali/util/sliceutil"
)

// NamespaceService deals with fetching k8sClients namespaces / OpenShift projects and convert to kiali model
type NamespaceService struct {
	conf                  *config.Config
	discovery             istio.MeshDiscovery
	homeClusterUserClient kubernetes.UserClientInterface
	kialiCache            cache.KialiCache
	kialiSAClients        map[string]kubernetes.ClientInterface
	userClients           map[string]kubernetes.UserClientInterface
}

type AccessibleNamespaceError struct {
	msg string
}

// NewAccessibleNamespaceError returns an error indicating the namespace is
// not in the user's accessible set for the cluster. Callers (including
// tests outside this package) should use this constructor.
func NewAccessibleNamespaceError(msg string) *AccessibleNamespaceError {
	return &AccessibleNamespaceError{msg: msg}
}

func (in *AccessibleNamespaceError) Error() string {
	return in.msg
}

func IsAccessibleError(err error) bool {
	// errors.As rather than a type assertion: the error flows through many
	// business paths that may wrap it, and a wrapped assertion miss would
	// downgrade a 403 into a 500.
	var accessibleErr *AccessibleNamespaceError
	return errors.As(err, &accessibleErr)
}

// namespaceComputeUnreachableErr is the error returned when a cluster's
// accessible-namespace-set computation is suppressed because the cluster is marked
// unreachable (see cache.KialiCache.MarkClusterUnreachable).
func namespaceComputeUnreachableErr(cluster string) error {
	return fmt.Errorf("namespaces for cluster [%s] cannot be computed: %w", cluster, cache.ErrClusterUnreachable)
}

func NewNamespaceService(
	cache cache.KialiCache,
	conf *config.Config,
	discovery istio.MeshDiscovery,
	kialiSAClients map[string]kubernetes.ClientInterface,
	userClients map[string]kubernetes.UserClientInterface,
) NamespaceService {
	homeClusterName := conf.KubernetesConfig.ClusterName

	return NamespaceService{
		conf:                  conf,
		discovery:             discovery,
		homeClusterUserClient: userClients[homeClusterName],
		kialiCache:            cache,
		kialiSAClients:        kialiSAClients,
		userClients:           userClients,
	}
}

// GetClusterList Returns a list of cluster names based on the user clients
func (in *NamespaceService) GetClusterList() []string {
	var clusterList []string
	for cluster := range in.userClients {
		clusterList = append(clusterList, cluster)
	}
	return clusterList
}

// GetKialiSAClusterList returns a list of cluster names based on the Kiali SA clients.
// This represents all clusters that Kiali itself has access to.
func (in *NamespaceService) GetKialiSAClusterList() []string {
	var clusterList []string
	for cluster := range in.kialiSAClients {
		clusterList = append(clusterList, cluster)
	}
	return clusterList
}

// namespaceSetFlight coalesces concurrent accessible-set computations per
// (cacheKey, cluster). It is package-level because NamespaceService is
// created per request; the computation result for a given token+cluster is
// identical across instances.
var namespaceSetFlight singleflight.Group

// GetClusterNamespacesForCluster returns the user's accessible namespaces
// for a single cluster, checking and filling the per-token cache for that
// cluster only. The result — including an empty one — is cached, so the
// presence of the cache entry is authoritative for the token's TTL (no
// recompute on subsequent requests, denied or not). Concurrent computations
// for the same (token, cluster) are coalesced. Do not mutate the returned
// slice: it is shared between concurrent callers.
//
// Unlike GetNamespaces (and the GetClusterNamespaces convenience filter over
// it), which follow picker semantics — a remote cluster whose set cannot be
// computed is skipped, yielding no namespaces and no error — this propagates
// the error for the requested cluster, home or remote. Use it when the answer
// is load-bearing (e.g. deciding whether a session still has any access)
// rather than a best-effort listing.
func (in *NamespaceService) GetClusterNamespacesForCluster(ctx context.Context, cluster string) ([]models.Namespace, error) {
	// A cluster with no user client is an access denial, not an internal
	// error: callers map AccessibleNamespaceError to 403. A cluster marked
	// unreachable is the exception: the missing client comes from its skipped session
	// validation, which is Kiali's connectivity problem, not the user's access - the
	// fitting answer is the 503 of cache.ErrClusterUnreachable.
	client, ok := in.userClients[cluster]
	if !ok {
		if in.kialiCache.IsClusterUnreachable(cluster) {
			return nil, cache.NewClusterUnreachableError(cluster)
		}
		return nil, NewAccessibleNamespaceError("cluster [" + cluster + "] is not found or is not accessible for Kiali")
	}
	cacheKey := client.GetCacheKey()

	// A warm entry is the final answer: the set was already computed for this
	// token+cluster (an empty entry means the user has zero accessible
	// namespaces in the cluster).
	if cached, found := in.kialiCache.GetNamespaces(cluster, cacheKey); found {
		return cached, nil
	}

	// The computation is shared across concurrent callers. Run it detached
	// from the leader's request context: a leader disconnecting mid-flight
	// would otherwise degrade the result (e.g. control plane decorations
	// silently skipped when discovery calls fail) for every follower, and
	// the degraded set would be cached. One key identifies the computation
	// for the singleflight coalescing.
	computeKey := cache.NewNamespaceComputeKey(cluster, cacheKey)
	result, err, _ := namespaceSetFlight.Do(string(computeKey), func() (any, error) {
		// Bound the whole computation: it is a sequence of per-namespace round trips, and
		// several individually-bounded slow successes could otherwise sum past the request
		// latency budget. The bound is kiali_internal.kubernetes_client.namespace_set_compute_timeout;
		// 0 disables it. The deadline is detached from the caller like the rest of the
		// computation; on expiry the cluster's set errors (the picker skips it, existing
		// semantics) and is never cached as an empty set.
		computeCtx := context.WithoutCancel(ctx)
		var cancel context.CancelFunc = func() {}
		if timeout := in.conf.KialiInternal.KubernetesClient.NamespaceSetComputeTimeout; timeout > 0 {
			computeCtx, cancel = context.WithTimeout(computeCtx, timeout)
		}
		defer cancel()

		// A cluster marked unreachable is not probed from the request path: the shared
		// signal (see kialiCache.MarkClusterUnreachable) suspends every request-path
		// probe of the cluster, and the background prober re-checks it. The home
		// cluster is exempt: it is reachable by definition, its failures are
		// exceptional and fail loud.
		if cluster != in.conf.KubernetesConfig.ClusterName && in.kialiCache.IsClusterUnreachable(cluster) {
			return nil, namespaceComputeUnreachableErr(cluster)
		}

		namespaces, err := in.fetchNamespacesForCluster(computeCtx, cluster)
		if err != nil {
			// Only a transport-level failure marks the cluster unreachable - the same
			// classification the background prober uses when it clears the mark. An
			// API-level answer, even an authorization denial, proves the cluster is
			// reachable; marking on it would only flap against the prober's next clear.
			if kubernetes.IsConnectionError(err) {
				in.kialiCache.MarkClusterUnreachable(cluster)
			}
			return nil, err
		}
		if computeCtx.Err() != nil {
			// The deadline expired while the set was still being fetched: per-namespace
			// round trips may have been cut short, and caching the result would serve a
			// truncated set for the whole token TTL. Fail instead.
			err := fmt.Errorf("namespaces for cluster [%s] took too long to compute: %w", cluster, computeCtx.Err())
			in.kialiCache.MarkClusterUnreachable(cluster)
			return nil, err
		}

		// The remaining steps resolve the mesh (control-plane decorations and the
		// control-plane discovery selectors), which scans every cluster and can cost a
		// remote's full request timeout while the mesh cache rebuilds during an outage.
		// They are deliberately outside the truncation guard above: with the deadline
		// expired they degrade the result (no decorations; the config's selectors only)
		// rather than fail the computation - failing here made the home cluster's
		// namespace requests 500 whenever a mesh rebuild landed inside its compute
		// budget, poisoning the mandatory cluster with a remote's outage.
		namespaces = in.decorateNamespaces(computeCtx, namespaces, cluster)
		namespaces = istio.FilterNamespacesWithDiscoverySelectors(namespaces, istio.GetDiscoverySelectorsForCluster(computeCtx, in.discovery, cluster, in.conf))

		in.kialiCache.SetClusterNamespaces(cacheKey, cluster, namespaces)
		return namespaces, nil
	})
	if err != nil {
		return nil, err
	}
	namespaces, _ := result.([]models.Namespace)
	return namespaces, nil
}

// Returns a list of the given namespaces / projects
func (in *NamespaceService) GetNamespaces(ctx context.Context) ([]models.Namespace, error) {
	var end observability.EndFunc
	_, end = observability.StartSpan(ctx, "GetNamespaces",
		observability.Attribute("package", "business"),
	)
	defer end()

	// kiali cache saves namespaces per token + cluster. The same token can be
	// used for multiple clusters.
	namespaces := []models.Namespace{}

	// Fast path: serve entirely from the cache when every cluster's entry is
	// warm — this is a hot path (the picker, HasMeshAccess, the graph engine
	// and the trace access check all call it).
	clustersToCompute := make([]string, 0, len(in.userClients))
	for cluster, client := range in.userClients {
		if cached, found := in.kialiCache.GetNamespaces(cluster, client.GetCacheKey()); found {
			namespaces = append(namespaces, cached...)
		} else {
			clustersToCompute = append(clustersToCompute, cluster)
		}
	}
	if len(clustersToCompute) == 0 {
		return namespaces, nil
	}

	wg := &sync.WaitGroup{}
	type result struct {
		cluster string
		ns      []models.Namespace
		err     error
	}
	resultsCh := make(chan result)

	// TODO: Use a context to define a timeout. The context should be passed to the k8s client
	go func() {
		for _, cluster := range clustersToCompute {
			wg.Add(1)
			go func(c string) {
				defer wg.Done()
				// GetClusterNamespacesForCluster checks the per-token cache
				// first and filters namespaces using discovery selectors; we
				// don't have to do either here.
				list, err := in.GetClusterNamespacesForCluster(ctx, c)
				resultsCh <- result{cluster: c, ns: list, err: err}
			}(cluster)
		}
		wg.Wait()
		close(resultsCh)
	}()

	// Combine namespace data. Home cluster errors fail the request; remote
	// cluster errors are logged and skipped (picker semantics). Drain the
	// whole channel before returning so workers never block on send.
	var homeErr error
	for resultCh := range resultsCh {
		if resultCh.err != nil {
			if resultCh.cluster == in.conf.KubernetesConfig.ClusterName {
				log.Errorf("Error fetching Namespaces for local cluster [%s]: %s", resultCh.cluster, resultCh.err)
				homeErr = resultCh.err
			} else {
				log.Infof("Error fetching Namespaces for cluster [%s]: %s", resultCh.cluster, resultCh.err)
			}
			continue
		}
		namespaces = append(namespaces, resultCh.ns...)
	}
	if homeErr != nil {
		return nil, homeErr
	}

	return namespaces, nil
}

// fetchNamespacesForCluster fetches the user's namespace set for the given cluster,
// undecorated and unfiltered. It is the authorization-critical part of the computation
// (see GetClusterNamespacesForCluster): its result must be complete within the compute
// budget, which is why it is separated from the mesh-dependent decoration and
// discovery-selector filtering the caller applies afterwards.
func (in *NamespaceService) fetchNamespacesForCluster(ctx context.Context, cluster string) ([]models.Namespace, error) {
	var namespaces []models.Namespace

	// Note that cluster-wide-access mode requires cluster role permission to list all namespaces.
	if in.conf.Deployment.ClusterWideAccess {
		// get the intersection of KialiSA and user namespaces
		nss, err := in.getNamespacesUsingKialiSA(ctx, cluster, "")
		if err != nil {
			return nil, err
		}

		namespaces = models.CastNamespaceCollection(nss, cluster)
	} else {
		// We do not have cluster wide access, so we do not have permission to list namespaces. Therefore, we assume we can
		// extract the list of accessible namespaces from the discovery selectors configuration. That list of accessible
		// namespaces will be used as our base list which we then filter with discovery selectors down below.
		// The base list is the cluster's own effective scope - its discovery selector override when one
		// is defined, otherwise the default accessible namespaces - resolved through the same source the
		// remote caches and the live access check use, so discovery can never name a namespace the
		// cluster's informers are not scoped to.
		accessibleNamespaces := cache.AccessibleNamespacesForCluster(in.conf, cluster)
		k8sNamespaces, err := getNamespacesByName(ctx, in.userClients[cluster], accessibleNamespaces)
		if err != nil {
			return nil, err
		}
		namespaces = models.CastNamespaceCollection(k8sNamespaces, cluster)
	}

	return namespaces, nil
}

// decorateNamespaces applies the SA-sourced decorations (control plane,
// revision, ambient) to an already-cast namespace collection. It is the
// shared tail of GetClusterNamespacesForCluster and GetSAClusterNamespaces: the
// decorations come from the mesh discovery and the Kiali cache, never from
// the requesting user's visibility, so both paths produce identically
// decorated namespaces.
func (in *NamespaceService) decorateNamespaces(ctx context.Context, namespaces []models.Namespace, cluster string) []models.Namespace {
	// here is called GetControlPlaneNamespaces instead of IsControlPlane for performance reasons
	cpnList := in.discovery.GetControlPlaneNamespaces(ctx, cluster)
	cpnSet := make(map[string]struct{}, len(cpnList))
	for _, n := range cpnList {
		cpnSet[n] = struct{}{}
	}

	// Revisions for control plane namespaces from the mesh.
	cpRevisionsByNamespace := make(map[string][]string)
	if mesh, err := in.discovery.Mesh(ctx); err == nil {
		for _, cp := range mesh.ControlPlanes {
			if cp.Cluster != nil && cp.Cluster.Name == cluster {
				rev := cp.Revision
				if rev == "" {
					rev = models.DefaultRevisionLabel
				}
				cpRevisionsByNamespace[cp.IstiodNamespace] = append(cpRevisionsByNamespace[cp.IstiodNamespace], rev)
			}
		}
		// Deduplicate and sort for consistent display
		for ns := range cpRevisionsByNamespace {
			revs := cpRevisionsByNamespace[ns]
			seen := make(map[string]struct{}, len(revs))
			unique := revs[:0]
			for _, r := range revs {
				if _, ok := seen[r]; !ok {
					seen[r] = struct{}{}
					unique = append(unique, r)
				}
			}
			sort.Strings(unique)
			cpRevisionsByNamespace[ns] = unique
		}
	}

	for i := range namespaces {
		_, ok := cpnSet[namespaces[i].Name]
		namespaces[i].IsControlPlane = ok

		if ok {
			if revs, hasRevs := cpRevisionsByNamespace[namespaces[i].Name]; hasRevs && len(revs) > 0 {
				namespaces[i].Revision = strings.Join(revs, ",")
			}
			if in.kialiCache.IsAmbientEnabled(ctx, cluster) {
				in.validateControlPlaneNamespaceAmbient(ctx, &namespaces[i], cluster)
			}
		}
	}

	return namespaces
}

// GetSAClusterNamespaces returns the namespaces visible to the Kiali
// ServiceAccount for the cluster, with the same decorations as
// GetClusterNamespaces. Where GetClusterNamespaces intersects the SA list
// with the requesting user's visibility, this returns the full SA set: it
// backs computations that must match the background validators (which run
// with SA visibility) regardless of who triggered them, so their results
// can populate the shared validation cache that every user reads through
// the per-user filtering.
func (in *NamespaceService) GetSAClusterNamespaces(ctx context.Context, cluster string) ([]models.Namespace, error) {
	namespaces, err := in.GetKialiSAClusterNamespaces(ctx, cluster)
	if err != nil {
		return nil, err
	}
	// GetKialiSAClusterNamespaces already applied the discovery selectors.
	return in.decorateNamespaces(ctx, namespaces, cluster), nil
}

// GetClusterNamespaces is just a convenience routine that filters GetNamespaces for a particular cluster
func (in *NamespaceService) GetClusterNamespaces(ctx context.Context, cluster string) ([]models.Namespace, error) {
	tokenNamespaces, err := in.GetNamespaces(ctx)
	if err != nil {
		return nil, err
	}

	clusterNamespaces := []models.Namespace{}
	for _, ns := range tokenNamespaces {
		if ns.Cluster == cluster {
			clusterNamespaces = append(clusterNamespaces, ns)
		}
	}

	return clusterNamespaces, nil
}

// GetKialiSAClusterNamespaces returns the namespaces accessible to the Kiali Service Account
// for the specified cluster, filtered by discovery selectors. This is useful for comparing
// against user-accessible namespaces to determine if the user has full namespace access.
func (in *NamespaceService) GetKialiSAClusterNamespaces(ctx context.Context, cluster string) ([]models.Namespace, error) {
	saClient, ok := in.kialiSAClients[cluster]
	if !ok {
		return nil, fmt.Errorf("cluster [%s] is not found or is not accessible for Kiali SA: %w", cluster, cache.ErrClusterNotCached)
	}

	// The SA set is cached under its own key, deliberately distinct from the
	// per-token user keys: in anonymous (or RBAC-disabled) mode the user
	// client IS the SA client and shares its token, so a shared key would let
	// this (undecorated) list collide with the user's accessible set — which
	// carries the control-plane, revision and ambient decorations
	// GetClusterNamespacesForCluster adds.
	saCacheKey := "kiali-sa:" + saClient.GetCacheKey()
	if cachedNs, found := in.kialiCache.GetNamespaces(cluster, saCacheKey); found {
		return cachedNs, nil
	}

	// The SA set computation is a request-path probe like the user's: a cluster marked
	// unreachable is skipped, and the background prober re-checks it (see
	// kialiCache.MarkClusterUnreachable). The home cluster is exempt.
	if cluster != in.conf.KubernetesConfig.ClusterName && in.kialiCache.IsClusterUnreachable(cluster) {
		return nil, namespaceComputeUnreachableErr(cluster)
	}

	var namespaces []models.Namespace

	if in.conf.Deployment.ClusterWideAccess {
		nss, err := saClient.GetNamespaces(ctx, "")
		if err != nil {
			// Transport failures only, like the user-path computation above: an
			// authorization denial is an API-level answer, not an unreachable cluster.
			if kubernetes.IsConnectionError(err) {
				in.kialiCache.MarkClusterUnreachable(cluster)
			}
			return nil, err
		}
		namespaces = models.CastNamespaceCollection(nss, cluster)
	} else {
		// The cluster's own effective scope (override-aware), matching the user path and the
		// informer scoping - see fetchNamespacesForCluster.
		accessibleNamespaces := cache.AccessibleNamespacesForCluster(in.conf, cluster)
		k8sNamespaces := make([]core_v1.Namespace, 0)
		for _, ans := range accessibleNamespaces {
			k8sNs, err := saClient.GetNamespace(ctx, ans)
			if err != nil {
				if k8serrors.IsNotFound(err) || k8serrors.IsForbidden(err) {
					continue
				}
				// Transport failures only, like the user-path computation above.
				if kubernetes.IsConnectionError(err) {
					in.kialiCache.MarkClusterUnreachable(cluster)
				}
				return nil, err
			}
			k8sNamespaces = append(k8sNamespaces, *k8sNs)
		}
		namespaces = models.CastNamespaceCollection(k8sNamespaces, cluster)
	}

	// Apply discovery selector filtering
	namespaces = istio.FilterNamespacesWithDiscoverySelectors(namespaces, istio.GetDiscoverySelectorsForCluster(ctx, in.discovery, cluster, in.conf))

	// SetClusterNamespaces also caches an empty SA set: the entry's presence
	// is the "set computed" signal, so a cluster where the SA sees no
	// namespaces is not recomputed on every call.
	in.kialiCache.SetClusterNamespaces(saCacheKey, cluster, namespaces)

	return namespaces, nil
}

// CheckNamespaceAccessAllClusters authorizes a namespace for a query that
// is NOT cluster-scoped (e.g. a Prometheus query built without a cluster
// label). The namespace must be in the user's accessible set for every
// SA-visible cluster where the namespace exists; a cluster where the user
// has no client, where the user is denied, or whose sets cannot be
// evaluated counts as denied — skipping it would let that cluster's data
// through the unscoped query. It returns the namespace entries from the
// clusters where it is accessible (possibly empty when the namespace exists
// in no cluster), an AccessibleNamespaceError when the user is denied, or
// the home-cluster computation error.
func (in *NamespaceService) CheckNamespaceAccessAllClusters(ctx context.Context, namespace string) ([]models.Namespace, error) {
	var accessible []models.Namespace
	homeCluster := in.conf.KubernetesConfig.ClusterName
	notAccessible := func() error {
		return NewAccessibleNamespaceError("namespace [" + namespace + "] is not accessible in every cluster where it exists")
	}

	// A skipped cluster (registration definitively broken at startup) is invisible to the
	// SA-client list below, but its telemetry may still be present in unscoped queries. Whether
	// the namespace exists there cannot be evaluated, so the authorization fails closed:
	// skipping the cluster would let its data through the unscoped query. An unreadable
	// remote secret has the same effect with no cluster to name: the clusters it defines
	// are unknown, so the inventory cannot be treated as complete.
	if len(in.kialiCache.SkippedClusters()) > 0 || len(in.kialiCache.UnreadableRemoteSecrets()) > 0 {
		return nil, notAccessible()
	}

	for _, cluster := range in.GetKialiSAClusterList() {
		// The revocation mark is checked before the SA membership: a partially revoked
		// namespace is also dropped from the SA's readable set on recompute (its per-namespace
		// GET comes back Forbidden), so checking membership first would skip the cluster and
		// pass the unscoped query on the strength of the remaining clusters. A fully
		// degraded cluster clears its partial marks, so its degradation is checked the same
		// way - its recomputed SA set comes back empty (every GET Forbidden) and would
		// otherwise place no demand on the user while its telemetry stays queryable.
		if in.kialiCache.IsNamespaceRevoked(cluster, namespace) {
			return nil, notAccessible()
		}

		// The SA set tells us where the namespace exists at all; clusters
		// without it place no demand on the user.
		saNamespaces, err := in.GetKialiSAClusterNamespaces(ctx, cluster)
		if err != nil {
			if cluster == homeCluster {
				return nil, err
			}
			// A remote cluster that cannot be evaluated is treated as denied
			// for an unscoped query: fail closed.
			return nil, notAccessible()
		}
		if !models.Namespaces(saNamespaces).Includes(namespace) {
			continue
		}

		// The namespace exists in this cluster: the user must be able to see
		// it here. A cluster with no user client also surfaces as an
		// AccessibleNamespaceError from GetClusterNamespacesForCluster, which
		// the error handling below treats as denied.
		userNamespaces, err := in.GetClusterNamespacesForCluster(ctx, cluster)
		if err != nil {
			if cluster == homeCluster {
				return nil, err
			}
			return nil, notAccessible()
		}
		ns, err := namespaceFromAccessibleSet(userNamespaces, namespace, cluster)
		if err != nil {
			return nil, notAccessible()
		}
		accessible = append(accessible, *ns)
	}

	return accessible, nil
}

// GetNamespaceClusters is a convenience routine that filters GetNamespaces for a particular namespace
func (in *NamespaceService) GetNamespaceClusters(ctx context.Context, namespace string) ([]models.Namespace, error) {
	namespaces, err := in.GetNamespaces(ctx)
	if err != nil {
		return nil, err
	}

	result := []models.Namespace{}
	for _, ns := range namespaces {
		if ns.Name == namespace {
			result = append(result, ns)
		}
	}

	return result, nil
}

// GetClusterNamespace returns the definition of the specified namespace,
// resolved against the user's accessible set for the cluster (see
// GetClusterNamespaces). It never falls through to a bare namespace GET on a
// cache miss, so the answer does not depend on per-token cache warmth. A
// namespace that is not in the accessible set — because the user cannot see
// it, or because discovery selectors exclude it — returns an
// AccessibleNamespaceError. A cluster the user has no client for also
// returns an AccessibleNamespaceError (it counts as "not accessible").
func (in *NamespaceService) GetClusterNamespace(ctx context.Context, namespace string, cluster string) (*models.Namespace, error) {
	var end observability.EndFunc
	_, end = observability.StartSpan(ctx, "GetClusterNamespace",
		observability.Attribute("package", "business"),
		observability.Attribute("namespace", namespace),
		observability.Attribute(observability.TracingClusterTag, cluster),
	)
	defer end()

	// The client is resolved here, rather than left to
	// GetClusterNamespacesForCluster, because the indexed read below needs
	// the cache key. A cluster with no user client is the same
	// AccessibleNamespaceError the computation path produces - unless the cluster was
	// skipped at startup (a definitively broken registration), which is a 404 "Kiali does
	// not know this cluster", not an access denial, so it stays consistent with the
	// cache-based routes.
	client, ok := in.userClients[cluster]
	if !ok {
		if in.kialiCache.IsClusterSkipped(cluster) {
			return nil, fmt.Errorf("cluster [%s]: %w", cluster, cache.ErrClusterNotCached)
		}
		// An unreachable cluster has no user client because its session validation was
		// skipped - Kiali's connectivity problem, not the user's access. The fitting
		// answer is the 503 of ErrClusterUnreachable, not the 403 of a denial.
		if in.kialiCache.IsClusterUnreachable(cluster) {
			return nil, cache.NewClusterUnreachableError(cluster)
		}
		return nil, NewAccessibleNamespaceError("cluster [" + cluster + "] is not found or is not accessible for Kiali")
	}

	// Resolve against the per-(token, cluster) accessible-set cache in one
	// indexed read: a warm set answers authorization outright — hit or
	// denial — without materializing the set, which list flows check once
	// per namespace and would otherwise scale with the set size. Only a
	// token+cluster pair with no warm entry computes the set; that
	// computation is coalesced by GetClusterNamespacesForCluster's
	// singleflight, and the warm entry stays authoritative: a namespace
	// absent from it is simply not accessible — no recompute — in both modes.
	//
	// A namespace that passes the user's own authorization is then checked against the SA's
	// partial revocation: the user may still see it, but its informers are frozen and serving
	// the pre-revocation snapshot would show resources that may no longer exist. This gates
	// every detail path that authorizes through GetClusterNamespace (~20 call sites).
	if ns, inSet, setCached := in.kialiCache.ResolveClusterNamespace(cluster, client.GetCacheKey(), namespace); setCached {
		if !inSet {
			return nil, NewAccessibleNamespaceError("namespace [" + namespace + "] in cluster [" + cluster + "] is not accessible")
		}
		if in.kialiCache.IsNamespaceRevoked(cluster, namespace) {
			return nil, fmt.Errorf("namespace [%s] in cluster [%s]: %w", namespace, cluster, cache.ErrNamespaceRevoked)
		}
		return &ns, nil
	}

	clusterNamespaces, err := in.GetClusterNamespacesForCluster(ctx, cluster)
	if err != nil {
		return nil, err
	}
	ns, err := namespaceFromAccessibleSet(clusterNamespaces, namespace, cluster)
	if err != nil {
		return nil, err
	}
	if in.kialiCache.IsNamespaceRevoked(cluster, namespace) {
		return nil, fmt.Errorf("namespace [%s] in cluster [%s]: %w", namespace, cluster, cache.ErrNamespaceRevoked)
	}
	return ns, nil
}

// namespaceFromAccessibleSet returns the named namespace from the accessible
// set, or an AccessibleNamespaceError when it is not part of the set. The
// input slice aliases the shared cached set ("do not mutate"), so the
// returned namespace is a copy.
func namespaceFromAccessibleSet(namespaces []models.Namespace, namespace, cluster string) (*models.Namespace, error) {
	for i := range namespaces {
		if namespaces[i].Name == namespace {
			ns := namespaces[i]
			return &ns, nil
		}
	}
	return nil, NewAccessibleNamespaceError("namespace [" + namespace + "] in cluster [" + cluster + "] is not accessible")
}

func (in *NamespaceService) UpdateNamespace(ctx context.Context, namespace string, jsonPatch string, cluster string) (*models.Namespace, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "UpdateNamespace",
		observability.Attribute("package", "business"),
		observability.Attribute("namespace", namespace),
		observability.Attribute("jsonPatch", jsonPatch),
	)
	defer end()

	// A first check to run the accessible/excluded logic and not run the Update operation on filtered namespaces
	_, err := in.GetClusterNamespace(ctx, namespace, cluster)
	if err != nil {
		return nil, err
	}

	userClient, found := in.userClients[cluster]
	if !found {
		return nil, fmt.Errorf("cluster [%s] is not found or is not accessible for Kiali", cluster)
	}

	updatedNamespace, err := userClient.UpdateNamespace(namespace, jsonPatch)
	if err != nil {
		return nil, err
	}

	in.waitForCacheUpdate(ctx, cluster, updatedNamespace)
	in.kialiCache.RefreshTokenNamespaces(cluster)

	// Call GetClusterNamespaces to update the cache for this cluster.
	if _, err := in.GetClusterNamespaces(ctx, cluster); err != nil {
		return nil, err
	}

	return in.GetClusterNamespace(ctx, namespace, cluster)
}

func (in *NamespaceService) waitForCacheUpdate(ctx context.Context, cluster string, updatedNamespace *core_v1.Namespace) {
	kubeCache, err := in.kialiCache.GetKubeCache(cluster)
	if err != nil {
		log.Errorf("Namespace service cannot get cache so cannot wait for object to update in cache. You may see stale data but the update was processed correctly. Error: %s", err)
		return
	}

	if err := kubernetes.WaitForObjectUpdateInCache(ctx, kubeCache, updatedNamespace); err != nil {
		// It won't break anything if we return the object before it is updated in the cache.
		// We will just show stale data so just log an error here instead of failing.
		log.Errorf("Namespace service failed waiting for object to update in cache. You may see stale data but the update was processed correctly. Error: %s", err)
		return
	}
}

// getNamespacesUsingKialiSA returns the intersection of namespaces Listed for KialiSA, narrowed by labelSelector, and those the
// user can access (via List or Get, depending on the config)
func (in *NamespaceService) getNamespacesUsingKialiSA(ctx context.Context, cluster string, labelSelector string) ([]core_v1.Namespace, error) {
	nss, err := in.kialiSAClients[cluster].GetNamespaces(ctx, labelSelector)
	if err != nil {
		return nil, err
	}

	// When the user's effective identity is the same as the SA (e.g. anonymous auth
	// where no impersonation is involved), the SA list is already the correct answer.
	// Under impersonation, GetCacheKey() returns the impersonated username (never equal
	// to the SA's bearer token), so the RBAC intersection below always runs.
	if in.userClients[cluster].GetCacheKey() == in.kialiSAClients[cluster].GetToken() {
		return nss, nil
	}

	// When not in strict-get mode, try the user's own list; if it succeeds,
	// intersect it with the SA list so we never return namespaces that Kiali
	// itself cannot access.
	if !in.conf.KialiFeatureFlags.Authz.RequireNamespaceGet {
		userNss, userErr := in.userClients[cluster].GetNamespaces(ctx, labelSelector)
		if userErr == nil {
			saSet := make(map[string]struct{}, len(nss))
			for _, ns := range nss {
				saSet[ns.Name] = struct{}{}
			}
			var intersection []core_v1.Namespace
			for i := range userNss {
				if _, ok := saSet[userNss[i].Name]; ok {
					intersection = append(intersection, userNss[i])
				}
			}
			return intersection, nil
		}
		if !k8serrors.IsForbidden(userErr) {
			return nil, userErr
		}
	}

	return in.filterToNamespacesUserCanGet(ctx, cluster, nss)
}

func (in *NamespaceService) filterToNamespacesUserCanGet(ctx context.Context, cluster string, candidates []core_v1.Namespace) ([]core_v1.Namespace, error) {
	names := sliceutil.Map(candidates, func(ns core_v1.Namespace) string { return ns.Name })
	readable, err := getNamespacesByName(ctx, in.userClients[cluster], names)
	if err != nil {
		return nil, err
	}
	allowed := make(map[string]bool, len(readable))
	for _, ns := range readable {
		allowed[ns.Name] = true
	}
	return sliceutil.Filter(candidates, func(ns core_v1.Namespace) bool { return allowed[ns.Name] }), nil
}

// Probe a bounded number of namespaces concurrently while preserving the input order.
// Only a definite denial or deletion may remove one namespace from a successful set.
func getNamespacesByName(ctx context.Context, client kubernetes.ClientInterface, names []string) ([]core_v1.Namespace, error) {
	group, workCtx := errgroup.WithContext(ctx)
	group.SetLimit(16)
	byIndex := make([]*core_v1.Namespace, len(names))
	for i, name := range names {
		if workCtx.Err() != nil {
			break
		}
		group.Go(func() error {
			ns, err := client.GetNamespace(workCtx, name)
			if k8serrors.IsForbidden(err) || k8serrors.IsNotFound(err) {
				return nil
			}
			if err == nil {
				byIndex[i] = ns
			}
			return err
		})
	}
	if err := group.Wait(); err != nil {
		return nil, err
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	result := make([]core_v1.Namespace, 0, len(names))
	for _, ns := range byIndex {
		if ns != nil {
			result = append(result, *ns)
		}
	}
	return result, nil
}

// HasMeshAccess expects a request context and returns true if the the context can access
// any control plane namespace. The test is narrowed to the cluster, if provided.
func (in *NamespaceService) HasMeshAccess(ctx context.Context, cluster string) bool {
	var namespaces []models.Namespace
	var err error
	if cluster == "" {
		namespaces, err = in.GetNamespaces(ctx)
	} else {
		namespaces, err = in.GetClusterNamespaces(ctx, cluster)
	}
	if err != nil {
		log.Errorf("failed HasMeshAccess: %s", err)
		return false
	}

	for _, cpNamespace := range in.discovery.GetControlPlaneNamespaces(ctx, cluster) {
		for _, ns := range namespaces {
			if cpNamespace == ns.Name && (cluster == "" || cluster == ns.Cluster) {
				return true
			}
		}
	}

	return false
}

// validateControlPlaneNamespaceAmbient validates if a control plane namespace should be marked as ambient
// by checking if there's a ztunnel daemonset with the same revision in the same cluster.
// It modifies the namespace's IsAmbient field if validation fails.
func (in *NamespaceService) validateControlPlaneNamespaceAmbient(ctx context.Context, ns *models.Namespace, cluster string) {
	// Use the cache method to check if the namespace is ambient
	// Pass empty string for istiodName to check all istiod deployments
	ns.IsAmbient = in.kialiCache.IsControlPlaneNamespaceAmbient(ctx, cluster, ns.Name, "")
}
