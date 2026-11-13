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
// Every accessible namespace is checked on every run - there is no short-circuit on the
// first allowed or denied result - because a partial revocation is only visible by
// enumerating the full denied set. The sweep is O(accessible namespaces), bounded by
// the 5s check timeout, and only runs when a Forbidden watch error fires (debounced to
// once per 10s per resource) or the recovery probe re-checks.
func newAccessCheck(conf *config.Config, clientFactory kubernetes.ClientFactory) cache.AccessCheck {
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

		// Known race, accepted: when one namespace's check errors and another's is
		// denied, the errgroup returns whichever finished first, so a definitive denial
		// can be reported as unknown. The outcome is bounded by the debounce window
		// (10s) and conservative (the cache is kept and the check retried).
		var mu sync.Mutex
		denied := make([]string, 0, len(namespaces))
		g, gctx := errgroup.WithContext(ctx)
		g.SetLimit(accessCheckConcurrency)
		for _, namespace := range namespaces {
			g.Go(func() error {
				reviews, err := client.GetSelfSubjectAccessReview(gctx, namespace, group, resource, []string{"list", "watch"})
				if err != nil {
					return err
				}
				for _, review := range reviews {
					if !review.Status.Allowed {
						mu.Lock()
						denied = append(denied, namespace)
						mu.Unlock()
						return nil
					}
				}
				return nil
			})
		}
		if err := g.Wait(); err != nil {
			return cache.DeniedAccess{}, err
		}
		slices.Sort(denied)
		switch len(denied) {
		case 0:
			return cache.DeniedAccess{}, nil
		case len(namespaces):
			// Every accessible namespace denied the read: the cluster's access is gone.
			return cache.DeniedAccess{Cluster: true}, nil
		default:
			// A partial revocation: the cluster stays readable, the denied namespaces do not.
			return cache.DeniedAccess{Namespaces: denied}, nil
		}
	}
}
