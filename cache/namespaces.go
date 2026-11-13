package cache

import (
	"context"
	"slices"
	"sync"

	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/runtime"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

// warnedUnresolvableOverrides deduplicates the unresolvable-override warning: the scope
// resolution runs on every read path (mesh resolution, services, istio config), and a
// remote with a bad override would otherwise warn on every call.
var warnedUnresolvableOverrides sync.Map

// AccessibleNamespacesForCluster returns the namespaces that scope Kiali's access to the
// named cluster when not in cluster-wide access mode: the cluster's discovery selector
// override when one is defined, otherwise the default accessible namespaces. An override
// that cannot be resolved to a namespace list falls back to the default list with a
// warning, so a misconfigured override cannot silently break the access scope. This is the
// single source for the remote caches' namespace restriction and the live access check:
// the check must never evaluate a cluster against namespaces its cache was not scoped to.
func AccessibleNamespacesForCluster(conf *config.Config, cluster string) []string {
	if conf.Deployment.ClusterWideAccess {
		return nil
	}
	// The home cluster's access scope is always the default accessible namespaces:
	// overrides are a remote-cluster concept, and the operator creates the home
	// cluster's Roles from the default selectors only.
	if cluster == conf.KubernetesConfig.ClusterName {
		return conf.Deployment.AccessibleNamespaces
	}
	namespaces, err := conf.AccessibleNamespacesForCluster(cluster)
	if err != nil {
		if _, warned := warnedUnresolvableOverrides.LoadOrStore(cluster, struct{}{}); !warned {
			log.Warningf("The discovery selector override for cluster [%s] does not name accessible namespaces. Falling back to the default accessible namespaces. err=%s", cluster, err)
		}
		return conf.Deployment.AccessibleNamespaces
	}
	if len(namespaces) == 0 {
		return conf.Deployment.AccessibleNamespaces
	}
	return namespaces
}

// WithoutRevokedNamespaces returns the list without the cluster's partially-revoked
// namespaces (see RevokedNamespaces): their informers cannot refresh while the rest of the
// cluster stays readable, so reads from them would serve stale data. Use it for a
// caller-resolved namespace list; for the cluster's whole access scope see
// ReadableNamespaces.
func WithoutRevokedNamespaces(kialiCache KialiCache, cluster string, namespaces []string) []string {
	revoked := kialiCache.RevokedNamespaces(cluster)
	if len(revoked) == 0 {
		return namespaces
	}
	return slices.DeleteFunc(slices.Clone(namespaces), func(ns string) bool {
		return slices.Contains(revoked, ns)
	})
}

// ReadableNamespaces returns the namespaces that scope Kiali's access to the cluster,
// minus the partially-revoked ones, or nil when Kiali has cluster-wide access. It is the
// namespace list every cluster-wide read through the SA cache should list: one namespace
// at a time in non-cluster-wide-access mode (see ListInNamespaces), with a single
// cluster-scoped list (nil) in cluster-wide-access mode, where access cannot be denied
// per namespace.
func ReadableNamespaces(conf *config.Config, kialiCache KialiCache, cluster string) []string {
	scope := AccessibleNamespacesForCluster(conf, cluster)
	if scope == nil {
		return nil
	}
	return WithoutRevokedNamespaces(kialiCache, cluster, scope)
}

// ListClusterWide lists the resource type into list with no namespace restriction,
// served by the cluster-scoped informer of cluster-wide access mode. It exists so that
// "list everything" is an explicit choice: ListInNamespaces treats a nil or empty
// namespace list as "list nothing", never as cluster-wide, so a carelessly built empty
// list cannot bring back the all-namespaces stall on a revoked namespace's informer.
func ListClusterWide[L ctrlclient.ObjectList](ctx context.Context, reader ctrlclient.Reader, list L, opts ...ctrlclient.ListOption) error {
	return reader.List(ctx, list, opts...)
}

// ListReadable lists the resource type into list across the cluster's readable
// namespaces: the access scope minus the partially-revoked ones, or - when Kiali has
// cluster-wide access - one cluster-wide list. It is the one place that resolves the
// scope's nil (cluster-wide access) into ListClusterWide, so no caller handles that
// convention itself. See ListInNamespaces for why the non-cluster-wide list runs one
// namespace at a time.
func ListReadable[L ctrlclient.ObjectList](ctx context.Context, reader ctrlclient.Reader, conf *config.Config, kialiCache KialiCache, cluster string, list L, opts ...ctrlclient.ListOption) error {
	namespaces := ReadableNamespaces(conf, kialiCache, cluster)
	if namespaces == nil {
		return ListClusterWide(ctx, reader, list, opts...)
	}
	return ListInNamespaces(ctx, reader, namespaces, list, opts...)
}

// ListInNamespaces lists the resource type into list for each of the given namespaces,
// one list at a time: a cache list across all namespaces waits for every scoped
// namespace's informer to sync, and an informer for a namespace Kiali is forbidden from
// never syncs, so the whole list would stall for the read timeout and then fail - a
// namespace-level problem escalating to a cluster-level failure. The list must be
// non-empty; a nil or empty namespaces slice lists nothing (never cluster-wide - see
// ListClusterWide and ListReadable). Partially-revoked namespaces must already be
// excluded by the caller (see ReadableNamespaces and WithoutRevokedNamespaces): their
// informers are frozen, and reading them would serve stale data.
func ListInNamespaces[L ctrlclient.ObjectList](ctx context.Context, reader ctrlclient.Reader, namespaces []string, list L, opts ...ctrlclient.ListOption) error {
	if len(namespaces) == 0 {
		return meta.SetList(list, nil)
	}
	if len(namespaces) == 1 {
		// The common single-namespace request: one direct list, no extract-and-merge.
		return reader.List(ctx, list, append(slices.Clone(opts), ctrlclient.InNamespace(namespaces[0]))...)
	}
	// Each per-namespace list starts from a fresh copy of the (empty) list - like
	// controller-runtime's own multi-namespace cache - so no assumption is made about
	// whether the reader replaces or appends to the items. The results are extracted
	// before the next iteration and set back once at the end.
	var items []runtime.Object
	for _, namespace := range namespaces {
		nsList := list.DeepCopyObject().(ctrlclient.ObjectList)
		if err := reader.List(ctx, nsList, append(slices.Clone(opts), ctrlclient.InNamespace(namespace))...); err != nil {
			return err
		}
		extracted, err := meta.ExtractList(nsList)
		if err != nil {
			return err
		}
		items = append(items, extracted...)
	}
	return meta.SetList(list, items)
}
