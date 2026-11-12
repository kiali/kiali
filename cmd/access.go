package cmd

// This file is deliberately NOT tagged `!exclude_frontend`: the functions here are pure
// backend logic with no dependency on the embedded frontend, and keeping them untagged
// lets their tests run under `make test`, which builds with -tags exclude_frontend.

import (
	"context"
	"errors"
	"fmt"

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
		}
		log.Infof("A namespace appears to have been deleted or Kiali is forbidden from seeing it [err=%v]. Shutting down cache.", watchErr)
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

// accessCheckConcurrency bounds how many namespaces one access check queries at once. The
// check runs on the reflector's goroutine under a 5s budget, so a sequential sweep does not
// fit the budget on large non-cluster-wide installs.
const accessCheckConcurrency = 8

// errAllowed reports that an SSAR definitively said the resource is readable in a namespace.
// It is internal to newAccessCheck: the sentinel lets the errgroup cancel the remaining
// namespace checks on the first allowed result - a single readable namespace means the
// cluster is not revoked, so there is nothing more to learn.
var errAllowed = errors.New("access allowed")

// namespaceConfigs turns a list of namespace names into the cache's DefaultNamespaces restriction.
// An empty list means no restriction (all namespaces).
func namespaceConfigs(namespaces []string) map[string]ctrlcache.Config {
	if len(namespaces) == 0 {
		return nil
	}
	configs := make(map[string]ctrlcache.Config, len(namespaces))
	for _, namespace := range namespaces {
		configs[namespace] = ctrlcache.Config{}
	}
	return configs
}

// accessibleNamespacesForCluster returns the namespaces that scope Kiali's access to the named cluster when
// not in cluster-wide access mode: the cluster's discovery selector override when one is defined, otherwise
// the default accessible namespaces. An override that cannot be resolved to a namespace list falls back to
// the default list with a warning, so a misconfigured override cannot silently break the access scope. This
// must stay in sync with the cache namespace restriction built in newManager - the access check must never
// evaluate a cluster against namespaces its cache was not scoped to.
func accessibleNamespacesForCluster(conf *config.Config, cluster string) []string {
	if conf.Deployment.ClusterWideAccess {
		return nil
	}
	// The home cluster's access scope is always the default accessible namespaces: the
	// operator creates its Roles from the default discovery selectors only, so a
	// home-cluster discovery selector override - a view filter - must not steer the
	// access check to namespaces the home cache is not scoped to and no Roles exist for.
	if cluster == conf.KubernetesConfig.ClusterName {
		return conf.Deployment.AccessibleNamespaces
	}
	namespaces, err := conf.AccessibleNamespacesForCluster(cluster)
	if err != nil {
		log.Warningf("The discovery selector override for cluster [%s] does not name accessible namespaces. Falling back to the default accessible namespaces. err=%s", cluster, err)
		return conf.Deployment.AccessibleNamespaces
	}
	if len(namespaces) == 0 {
		return conf.Deployment.AccessibleNamespaces
	}
	return namespaces
}

// newAccessCheck asks the cluster, through a SelfSubjectAccessReview, whether the Kiali service
// account can still list and watch a resource. Without cluster-wide access it checks every
// accessible namespace, concurrently. A cluster counts as revoked only when no accessible
// namespace grants the read: a single readable namespace means the cluster is still serving,
// while a denied one may simply have been deleted (its Role dies with it) or individually
// revoked - degrading the whole cluster for that would turn a namespace-level problem into an
// outage of every page. The first allowed result short-circuits the sweep; concluding a
// revocation is O(accessible namespaces), bounded by the 5s check timeout.
func newAccessCheck(conf *config.Config, clientFactory kubernetes.ClientFactory) cache.AccessCheck {
	// Each cluster is verified against its own accessible namespaces so that per-cluster
	// discovery selector overrides are honored on the access path, not just in the views.
	clusterNamespaces := make(map[string][]string)
	if !conf.Deployment.ClusterWideAccess {
		for cluster := range clientFactory.GetSAClients() {
			clusterNamespaces[cluster] = accessibleNamespacesForCluster(conf, cluster)
		}
	}
	return func(ctx context.Context, cluster, group, resource string) (bool, error) {
		if resource == "" {
			return false, fmt.Errorf("the forbidden error does not name a resource")
		}
		client := clientFactory.GetSAClient(cluster)
		if client == nil {
			return false, fmt.Errorf("no client for cluster [%s]", cluster)
		}
		namespaces := []string{""}
		if !conf.Deployment.ClusterWideAccess {
			namespaces = clusterNamespaces[cluster]
			if namespaces == nil {
				// A cluster unknown to the client factory when the check was built is
				// still verified against the default accessible namespaces.
				namespaces = conf.Deployment.AccessibleNamespaces
			}
		}

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
						// A denied namespace is not, on its own, a revocation: only when
						// every accessible namespace is denied is the cluster's access gone.
						return nil
					}
				}
				return errAllowed
			})
		}
		if err := g.Wait(); err != nil {
			if errors.Is(err, errAllowed) {
				return true, nil
			}
			return false, err
		}
		// Every accessible namespace denied the read: the cluster's access is gone.
		return false, nil
	}
}
