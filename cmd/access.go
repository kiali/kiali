package cmd

// This file is deliberately NOT tagged `!exclude_frontend`: the functions here are pure
// backend logic with no dependency on the embedded frontend, and keeping them untagged
// lets their tests run under `make test`, which builds with -tags exclude_frontend.

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"sync"

	"golang.org/x/sync/errgroup"
	extentionsv1alpha1 "istio.io/client-go/pkg/apis/extensions/v1alpha1"
	networkingv1 "istio.io/client-go/pkg/apis/networking/v1"
	networkingv1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"
	securityv1 "istio.io/client-go/pkg/apis/security/v1"
	telemetryv1 "istio.io/client-go/pkg/apis/telemetry/v1"
	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	toolscache "k8s.io/client-go/tools/cache"
	ctrlcache "sigs.k8s.io/controller-runtime/pkg/cache"
	"sigs.k8s.io/controller-runtime/pkg/client"
	k8sinferencev1 "sigs.k8s.io/gateway-api-inference-extension/api/v1"
	k8snetworkingv1 "sigs.k8s.io/gateway-api/apis/v1"
	k8snetworkingv1beta1 "sigs.k8s.io/gateway-api/apis/v1beta1"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
)

// accessCheckConcurrency bounds how many namespaces one access check queries at once. The
// check runs on the reflector's goroutine under a 5s budget, so a sequential sweep does not
// fit the budget on large non-cluster-wide installs.
const accessCheckConcurrency = 8

// accessCheckMaxConcurrency scales the sweep with the namespace count: at large counts the
// 5s budget only covers the sweep if enough namespaces are in flight (each namespace costs
// SSAR round trips through the client's rate limiter).
const accessCheckMaxConcurrency = 64

// makeWatchErrorHandler tears down a cluster's informers on a Forbidden watch error. When
// clusterAccess is set, it only does so after a live check confirms the access was revoked.
func makeWatchErrorHandler(getCache func() ctrlcache.Cache, k8sClient kubernetes.ClientInterface, clusterAccess *cache.ClusterAccess) func(context.Context, *toolscache.Reflector, error) {
	return func(ctx context.Context, r *toolscache.Reflector, watchErr error) {
		if !apierrors.IsForbidden(watchErr) {
			return
		}
		if clusterAccess != nil {
			group, resource := forbiddenResource(watchErr)
			if !clusterAccess.ConfirmRevoked(ctx, k8sClient.ClusterInfo().Name, group, resource) {
				return
			}
			log.Warningf("Confirmed revocation: Kiali can no longer read cluster [%s]. Removing the cluster's informers; reads will recover when access is restored. [err=%v]", k8sClient.ClusterInfo().Name, watchErr)
		} else {
			// The legacy path (cmd/gather) tears down on any Forbidden error without a
			// live check, so its message stays an explicitly unconfirmed guess.
			log.Infof("A namespace appears to have been deleted or Kiali is forbidden from seeing it [err=%v]. Shutting down cache.", watchErr)
		}
		objectsToRemove := []client.Object{
			&corev1.Pod{},
			&corev1.Service{},
			&appsv1.StatefulSet{},
			&appsv1.DaemonSet{},
			&corev1.ConfigMap{},
			&batchv1.CronJob{},
			&batchv1.Job{},
			&appsv1.Deployment{},
			&appsv1.ReplicaSet{},
			&networkingv1.Gateway{},
			&networkingv1.DestinationRule{},
			&networkingv1.Sidecar{},
			&networkingv1.ServiceEntry{},
			&networkingv1.VirtualService{},
			&networkingv1.WorkloadEntry{},
			&networkingv1.WorkloadGroup{},
			&extentionsv1alpha1.TrafficExtension{},
			&extentionsv1alpha1.WasmPlugin{},
			&networkingv1alpha3.EnvoyFilter{},
			&securityv1.AuthorizationPolicy{},
			&securityv1.PeerAuthentication{},
			&securityv1.RequestAuthentication{},
			&telemetryv1.Telemetry{},
		}
		if k8sClient.IsGatewayAPI() {
			objectsToRemove = append(objectsToRemove, &k8snetworkingv1.Gateway{})
			objectsToRemove = append(objectsToRemove, &k8snetworkingv1.GatewayClass{})
			objectsToRemove = append(objectsToRemove, &k8snetworkingv1.HTTPRoute{})
			objectsToRemove = append(objectsToRemove, &k8snetworkingv1.GRPCRoute{})
			objectsToRemove = append(objectsToRemove, &k8snetworkingv1beta1.ReferenceGrant{})
			objectsToRemove = append(objectsToRemove, &k8snetworkingv1.TLSRoute{})
		}
		if k8sClient.HasTCPRouteInV1() {
			objectsToRemove = append(objectsToRemove, &k8snetworkingv1.TCPRoute{})
		}
		if k8sClient.HasUDPRouteInV1() {
			objectsToRemove = append(objectsToRemove, &k8snetworkingv1.UDPRoute{})
		}
		if k8sClient.IsInferenceAPI() {
			objectsToRemove = append(objectsToRemove, &k8sinferencev1.InferencePool{})
		}
		c := getCache()
		if c == nil {
			log.Warningf("Cache not yet available, cannot remove informers")
			return
		}
		for _, obj := range objectsToRemove {
			log.Debugf("Removing informer for: %T", obj)
			if err := c.RemoveInformer(ctx, obj); err != nil {
				log.Errorf("Unable to remove informer: %s", err)
			}
		}
	}
}

// forbiddenResource returns the group and resource named in a Forbidden error, if it has
// them. A Forbidden error whose Details cannot be parsed (aggregated or proxy layers can
// produce those; the kube-apiserver always populates Details for list/watch) yields an
// empty resource: the access check then errors, the outcome is "unknown", and the cache
// is kept rather than torn down. That is intended - an unparseable error is not evidence
// of a revocation - at the cost that such an error never triggers a teardown.
func forbiddenResource(err error) (string, string) {
	var statusErr *apierrors.StatusError
	if !errors.As(err, &statusErr) || statusErr.ErrStatus.Details == nil {
		return "", ""
	}
	return statusErr.ErrStatus.Details.Group, statusErr.ErrStatus.Details.Kind
}

// seedRevokedAtStartup sweeps the core resource types on every configured cluster so that
// namespaces already denied at startup (e.g. one deleted before the restart, its Role dying
// with it) get their revocation marks seeded before any read: an informer for a namespace
// Kiali is forbidden from never syncs, and the first read through it would stall for the
// read timeout. The sweep runs through ConfirmRevoked's normal path, so a cluster that is
// fully revoked at startup is also degraded (and probed for recovery) like any other.
func seedRevokedAtStartup(ctx context.Context, clusterAccess *cache.ClusterAccess, clientFactory kubernetes.ClientFactory) {
	// Clusters are checked in parallel so an unreachable remote adds its own check
	// timeout to startup once, not once per remote ahead of it.
	var wg sync.WaitGroup
	for cluster := range clientFactory.GetSAClients() {
		wg.Add(1)
		go func(cluster string) {
			defer wg.Done()
			clusterAccess.ConfirmRevoked(ctx, cluster, "apps", "deployments")
			clusterAccess.ConfirmRevoked(ctx, cluster, "", "pods")
		}(cluster)
	}
	wg.Wait()
}

// cacheNamespaces returns the namespace restriction for a cluster's controller-runtime
// cache, home or remote. In non-cluster-wide-access mode the service account only holds
// per-namespace Roles, so a cluster-scoped informer is forbidden on every list and never
// syncs; scoping the cache to the accessible namespaces makes the informers work. The scope
// comes from cache.AccessibleNamespacesForCluster - the same source the live access check
// sweeps - so the check never evaluates a cluster against namespaces its cache was not
// scoped to.
func cacheNamespaces(conf *config.Config, clusterName string) map[string]ctrlcache.Config {
	namespaces := cache.AccessibleNamespacesForCluster(conf, clusterName)
	if len(namespaces) == 0 {
		return nil
	}
	configs := make(map[string]ctrlcache.Config, len(namespaces))
	for _, namespace := range namespaces {
		configs[namespace] = ctrlcache.Config{}
	}
	return configs
}

// newAccessCheck asks the cluster, through a SelfSubjectAccessReview, whether the Kiali service
// account can still list and watch a resource, and which accessible namespaces deny it.
// Without cluster-wide access it checks every accessible namespace, concurrently.
//
// A cluster counts as fully revoked only when no accessible namespace grants the read:
// degrading the whole cluster for one denied namespace would turn a namespace-level
// problem into an outage of every page. Instead, the denied namespaces are reported
// individually (a partial revocation): their informers cannot refresh, so callers hide
// their data rather than serve the frozen pre-revocation snapshot.
//
// Unfinished sweeps retain completed namespace decisions across bounded checks. The
// ClusterAccess caller coalesces simultaneous checks for the same cluster and resource.
func newAccessCheck(conf *config.Config, clientFactory kubernetes.ClientFactory) cache.AccessCheck {
	type sweepKey struct{ cluster, group, resource string }
	type progress struct{ denied, pending []string }
	var sweeps sync.Map
	return func(ctx context.Context, cluster, group, resource string) (cache.DeniedAccess, error) {
		if resource == "" {
			return cache.DeniedAccess{}, fmt.Errorf("the forbidden error does not name a resource")
		}
		client := clientFactory.GetSAClient(cluster)
		if client == nil {
			return cache.DeniedAccess{}, fmt.Errorf("no client for cluster [%s]", cluster)
		}
		namespaces := []string{""}
		if !conf.Deployment.ClusterWideAccess {
			// Each cluster is verified against its own accessible namespaces so that
			// per-cluster discovery selector overrides are honored on the access path,
			// not just in the views; a cluster the config does not know resolves to
			// the default accessible namespaces.
			namespaces = cache.AccessibleNamespacesForCluster(conf, cluster)
		}

		// Each cluster has a fixed accessible scope for the lifetime of this factory.
		key := sweepKey{cluster, group, resource}
		state := progress{pending: namespaces}
		if previous, ok := sweeps.Load(key); ok {
			state = previous.(progress)
		}
		type namespaceResult struct {
			denied bool
			err    error
		}
		results := make([]namespaceResult, len(state.pending))
		scheduled := 0
		var g errgroup.Group
		g.SetLimit(max(min(len(namespaces)/4, accessCheckMaxConcurrency), accessCheckConcurrency))
		for i, namespace := range state.pending {
			if ctx.Err() != nil {
				break
			}
			scheduled++
			g.Go(func() error {
				reviews, err := client.GetAccessSweepReview(ctx, namespace, group, resource, []string{"list", "watch"})
				for _, review := range reviews {
					// Either denied verb prevents a working informer, even when
					// the API could not answer the review for the other verb.
					if !review.Status.Allowed {
						results[i].denied = true
						return nil
					}
				}
				results[i].err = err
				return err
			})
		}
		err := g.Wait()
		// Give namespaces we haven't reached priority over those that returned errors.
		retry := slices.Clone(state.pending[scheduled:])
		for i, result := range results[:scheduled] {
			if result.err != nil {
				retry = append(retry, state.pending[i])
			} else if result.denied {
				state.denied = append(state.denied, state.pending[i])
			}
		}
		slices.Sort(state.denied)
		if len(retry) > 0 {
			if len(retry) == len(state.pending) && len(state.pending) < len(namespaces) {
				// A persistently failing namespace must not prevent rechecking
				// grants in the rest of the scope.
				sweeps.Delete(key)
			} else {
				sweeps.Store(key, progress{pending: retry, denied: state.denied})
			}
			if err == nil {
				err = ctx.Err()
			}
			return cache.DeniedAccess{Incomplete: !conf.Deployment.ClusterWideAccess, Namespaces: slices.Clone(state.denied)}, err
		}
		sweeps.Delete(key)
		if len(namespaces) > 0 && len(state.denied) == len(namespaces) {
			return cache.DeniedAccess{Cluster: true}, nil
		}
		return cache.DeniedAccess{Namespaces: state.denied}, nil
	}
}
