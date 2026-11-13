package cmd

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
	auth_v1 "k8s.io/api/authorization/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	kubefake "k8s.io/client-go/kubernetes/fake"
	k8stesting "k8s.io/client-go/testing"
	ctrlcache "sigs.k8s.io/controller-runtime/pkg/cache"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

// fakeClientWithAccess returns a fake client whose SelfSubjectAccessReviews allow only the
// given "namespace/group/resource/verb" entries.
func fakeClientWithAccess(allowed map[string]bool) *kubetest.FakeK8sClient {
	client := kubetest.NewFakeK8sClient()
	client.KubeClientset.(*kubefake.Clientset).PrependReactor("create", "selfsubjectaccessreviews",
		func(action k8stesting.Action) (bool, runtime.Object, error) {
			review := action.(k8stesting.CreateAction).GetObject().(*auth_v1.SelfSubjectAccessReview)
			attrs := review.Spec.ResourceAttributes
			key := fmt.Sprintf("%s/%s/%s/%s", attrs.Namespace, attrs.Group, attrs.Resource, attrs.Verb)
			review.Status.Allowed = allowed[key]
			return true, review, nil
		})
	return client
}

func TestForbiddenResource(t *testing.T) {
	forbidden := apierrors.NewForbidden(schema.GroupResource{Group: "apps", Resource: "deployments"}, "", errors.New("denied"))

	group, resource := forbiddenResource(fmt.Errorf("failed to list *v1.Deployment: %w", forbidden))
	require.Equal(t, "apps", group)
	require.Equal(t, "deployments", resource)

	group, resource = forbiddenResource(errors.New("plain error"))
	require.Empty(t, group)
	require.Empty(t, resource)
}

func TestAccessCheckClusterWide(t *testing.T) {
	conf := config.NewConfig()
	conf.Deployment.ClusterWideAccess = true
	client := fakeClientWithAccess(map[string]bool{
		"/apps/deployments/list":  true,
		"/apps/deployments/watch": true,
		"//pods/list":             true,
	})
	factory := kubetest.NewFakeClientFactory(conf, map[string]kubernetes.UserClientInterface{"west": client})
	check := newAccessCheck(conf, factory)

	denied, err := check(context.Background(), "west", "apps", "deployments")
	require.NoError(t, err)
	require.False(t, denied.Cluster)

	denied, err = check(context.Background(), "west", "", "pods")
	require.NoError(t, err)
	require.True(t, denied.Cluster, "watch on pods is not allowed")

	_, err = check(context.Background(), "unknown", "apps", "deployments")
	require.Error(t, err)

	_, err = check(context.Background(), "west", "", "")
	require.Error(t, err)
}

func TestAccessCheckChecksEachAccessibleNamespace(t *testing.T) {
	conf := config.NewConfig()
	conf.Deployment.ClusterWideAccess = false
	conf.Deployment.AccessibleNamespaces = []string{"bookinfo", "istio-system"}
	client := fakeClientWithAccess(map[string]bool{
		"bookinfo/apps/deployments/list":      true,
		"bookinfo/apps/deployments/watch":     true,
		"istio-system/apps/deployments/list":  true,
		"istio-system/apps/deployments/watch": true,
	})
	factory := kubetest.NewFakeClientFactory(conf, map[string]kubernetes.UserClientInterface{"west": client})

	denied, err := newAccessCheck(conf, factory)(context.Background(), "west", "apps", "deployments")
	require.NoError(t, err)
	require.False(t, denied.Cluster, "every accessible namespace is readable")
	require.Empty(t, denied.Namespaces)

	// A single denied namespace is not a revocation: the namespace may have been
	// deleted (its Role dies with it) or individually revoked, and the cluster
	// keeps serving the namespaces that are still readable. The denied namespace
	// is reported individually so callers can hide its stale informer data.
	conf.Deployment.AccessibleNamespaces = append(conf.Deployment.AccessibleNamespaces, "other")
	denied, err = newAccessCheck(conf, factory)(context.Background(), "west", "apps", "deployments")
	require.NoError(t, err)
	require.False(t, denied.Cluster, "a denied namespace alongside readable ones does not revoke the cluster")
	require.Equal(t, []string{"other"}, denied.Namespaces, "the denied namespace is reported for exclusion")

	// The cluster is revoked only when no accessible namespace grants the read.
	denyingClient := fakeClientWithAccess(map[string]bool{})
	denyingFactory := kubetest.NewFakeClientFactory(conf, map[string]kubernetes.UserClientInterface{"west": denyingClient})
	denied, err = newAccessCheck(conf, denyingFactory)(context.Background(), "west", "apps", "deployments")
	require.NoError(t, err)
	require.True(t, denied.Cluster, "every accessible namespace denied")
}

// A real SSAR API error must surface as an error - unknown - never a denial: mapping API
// errors to "denied" would tear down healthy-but-slow clusters, the exact failure the
// three-valued check outcome exists to prevent.
//
// Known race, accepted: when one namespace's check errors and another's is denied, the
// errgroup returns whichever finished first, so a definitive denial can be reported as
// unknown. That outcome is bounded by the debounce window (10s) and conservative (the
// cache is kept and the check retried). Do not write a timing assertion for this - it
// would be flaky in CI.
func TestAccessCheckAPIErrorIsUnknownNotDenied(t *testing.T) {
	conf := config.NewConfig()
	conf.Deployment.ClusterWideAccess = false
	conf.Deployment.AccessibleNamespaces = []string{"bookinfo"}
	client := kubetest.NewFakeK8sClient()
	client.KubeClientset.(*kubefake.Clientset).PrependReactor("create", "selfsubjectaccessreviews",
		func(action k8stesting.Action) (bool, runtime.Object, error) {
			return true, nil, fmt.Errorf("api server unavailable")
		})
	factory := kubetest.NewFakeClientFactory(conf, map[string]kubernetes.UserClientInterface{"west": client})
	check := newAccessCheck(conf, factory)

	_, err := check(context.Background(), "west", "apps", "deployments")
	require.Error(t, err)

	// The unknown outcome keeps the cache: ConfirmRevoked must not degrade the cluster.
	access := cache.NewClusterAccess(check)
	require.False(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))
	_, degraded := access.DegradedSince("west")
	require.False(t, degraded, "an API error is not evidence of a revocation")
}

func TestAccessCheckHonorsDiscoverySelectorOverrides(t *testing.T) {
	conf := config.NewConfig()
	conf.Deployment.ClusterWideAccess = false
	conf.Deployment.AccessibleNamespaces = []string{"bookinfo"}
	conf.Deployment.DiscoverySelectors.Default = config.DiscoverySelectorsType{
		&config.DiscoverySelectorType{MatchLabels: map[string]string{"kubernetes.io/metadata.name": "bookinfo"}},
	}
	conf.Deployment.DiscoverySelectors.Overrides = map[string]config.DiscoverySelectorsType{
		"west": {
			&config.DiscoverySelectorType{
				MatchExpressions: []metav1.LabelSelectorRequirement{
					{
						Key:      "kubernetes.io/metadata.name",
						Operator: metav1.LabelSelectorOpIn,
						Values:   []string{"west-ns"},
					},
				},
			},
		},
	}

	// The overridden cluster only grants access to its own override namespace: bookinfo is
	// not granted on west, so a check that asks about bookinfo (the home's default list)
	// would wrongly report the cluster as revoked.
	westAllowed := map[string]bool{
		"west-ns/apps/deployments/list":  true,
		"west-ns/apps/deployments/watch": true,
	}
	west := fakeClientWithAccess(westAllowed)
	east := fakeClientWithAccess(map[string]bool{
		"bookinfo/apps/deployments/list":  true,
		"bookinfo/apps/deployments/watch": true,
	})
	factory := kubetest.NewFakeClientFactory(conf, map[string]kubernetes.UserClientInterface{"west": west, "east": east})
	check := newAccessCheck(conf, factory)

	denied, err := check(context.Background(), "west", "apps", "deployments")
	require.NoError(t, err)
	require.False(t, denied.Cluster, "the overridden cluster is verified against its override namespaces only")

	// A cluster without an override is verified against the default accessible namespaces.
	denied, err = check(context.Background(), "east", "apps", "deployments")
	require.NoError(t, err)
	require.False(t, denied.Cluster)

	// Revoking the override namespace denies the overridden cluster: west-ns is west's
	// only namespace, so every accessible namespace is denied.
	westAllowed["west-ns/apps/deployments/watch"] = false
	denied, err = check(context.Background(), "west", "apps", "deployments")
	require.NoError(t, err)
	require.True(t, denied.Cluster, "the overridden cluster is denied when its override namespaces are revoked")

	// The home cluster never uses overrides: the operator creates its Roles from the
	// default discovery selectors only, so its check stays on the default accessible
	// namespaces. The west client grants west-ns but not bookinfo, so a check that
	// consulted west's override would wrongly pass.
	westAllowed["west-ns/apps/deployments/watch"] = true
	conf.KubernetesConfig.ClusterName = "west"
	check = newAccessCheck(conf, factory)
	denied, err = check(context.Background(), "west", "apps", "deployments")
	require.NoError(t, err)
	require.True(t, denied.Cluster, "the home cluster is checked against the default accessible namespaces, not its override")
}

func TestWatchErrorHandlerKeepsInformersOnTransientForbidden(t *testing.T) {
	forbidden := fmt.Errorf("failed to list *v1.Deployment: %w",
		apierrors.NewForbidden(schema.GroupResource{Group: "apps", Resource: "deployments"}, "", errors.New("denied")))
	client := kubetest.NewFakeK8sClient()
	cluster := client.ClusterInfo().Name

	// Capture the arguments the handler passes to the access check: a regression that
	// swapped the group and resource, or lost the cluster name, would otherwise pass.
	var gotCluster, gotGroup, gotResource string
	newAccess := func(allowed bool) *cache.ClusterAccess {
		return cache.NewClusterAccess(func(_ context.Context, c, g, r string) (cache.DeniedAccess, error) {
			gotCluster, gotGroup, gotResource = c, g, r
			if allowed {
				return cache.DeniedAccess{}, nil
			}
			return cache.DeniedAccess{Cluster: true}, nil
		})
	}

	teardowns := 0
	access := newAccess(true)
	handler := makeWatchErrorHandler(func() ctrlcache.Cache {
		teardowns++
		return nil
	}, client, access)

	handler(context.Background(), nil, forbidden)
	require.Zero(t, teardowns, "a forbidden error on a readable resource keeps the cache")
	require.Equal(t, cluster, gotCluster, "the check is asked about the erroring cluster")
	require.Equal(t, "apps", gotGroup)
	require.Equal(t, "deployments", gotResource)

	// A fresh tracker, so the debounce does not replay the allowed outcome above.
	access = newAccess(false)
	handler = makeWatchErrorHandler(func() ctrlcache.Cache {
		teardowns++
		return nil
	}, client, access)
	handler(context.Background(), nil, forbidden)
	require.Equal(t, 1, teardowns, "a confirmed revocation tears the cache down")
	_, degraded := access.DegradedSince(cluster)
	require.True(t, degraded)
}

// The nil-clusterAccess path is the legacy behavior, still used by cmd/gather: any
// Forbidden error tears the informers down without a live check.
func TestWatchErrorHandlerNilClusterAccessTearsDown(t *testing.T) {
	forbidden := fmt.Errorf("failed to list *v1.Deployment: %w",
		apierrors.NewForbidden(schema.GroupResource{Group: "apps", Resource: "deployments"}, "", errors.New("denied")))
	client := kubetest.NewFakeK8sClient()

	teardowns := 0
	handler := makeWatchErrorHandler(func() ctrlcache.Cache {
		teardowns++
		return nil
	}, client, nil)

	handler(context.Background(), nil, forbidden)
	require.Equal(t, 1, teardowns, "without clusterAccess any Forbidden error tears the cache down")
}

// recordingSSARClient answers SelfSubjectAccessReviews from the allowed map and records
// every namespace each review was asked about, so tests can observe which namespaces a
// check swept.
func recordingSSARClient(allowed map[string]bool, asked *[]string, mu *sync.Mutex) *kubetest.FakeK8sClient {
	client := kubetest.NewFakeK8sClient()
	client.KubeClientset.(*kubefake.Clientset).PrependReactor("create", "selfsubjectaccessreviews",
		func(action k8stesting.Action) (bool, runtime.Object, error) {
			review := action.(k8stesting.CreateAction).GetObject().(*auth_v1.SelfSubjectAccessReview)
			attrs := review.Spec.ResourceAttributes
			key := fmt.Sprintf("%s/%s/%s/%s", attrs.Namespace, attrs.Group, attrs.Resource, attrs.Verb)
			mu.Lock()
			*asked = append(*asked, attrs.Namespace)
			mu.Unlock()
			review.Status.Allowed = allowed[key]
			return true, review, nil
		})
	return client
}

func TestAccessCheckReportsDeniedNamespacesSorted(t *testing.T) {
	conf := config.NewConfig()
	conf.Deployment.ClusterWideAccess = false
	conf.Deployment.AccessibleNamespaces = []string{"bookinfo", "istio-system", "other"}
	client := kubetest.NewFakeK8sClient()
	// Allow everything except bookinfo and other.
	client.KubeClientset.(*kubefake.Clientset).PrependReactor("create", "selfsubjectaccessreviews",
		func(action k8stesting.Action) (bool, runtime.Object, error) {
			review := action.(k8stesting.CreateAction).GetObject().(*auth_v1.SelfSubjectAccessReview)
			attrs := review.Spec.ResourceAttributes
			review.Status.Allowed = attrs.Namespace != "other" && attrs.Namespace != "bookinfo"
			return true, review, nil
		})
	factory := kubetest.NewFakeClientFactory(conf, map[string]kubernetes.UserClientInterface{"west": client})

	denied, err := newAccessCheck(conf, factory)(context.Background(), "west", "apps", "deployments")
	require.NoError(t, err)
	require.False(t, denied.Cluster)
	require.Equal(t, []string{"bookinfo", "other"}, denied.Namespaces, "the denied set is sorted")
}

// A namespace that allows list but denies watch is denied: the real SSAR check asks for
// both verbs and a Role can split them.
func TestAccessCheckDeniesWhenOnlyWatchIsDenied(t *testing.T) {
	conf := config.NewConfig()
	conf.Deployment.ClusterWideAccess = false
	conf.Deployment.AccessibleNamespaces = []string{"bookinfo", "istio-system"}
	client := kubetest.NewFakeK8sClient()
	client.KubeClientset.(*kubefake.Clientset).PrependReactor("create", "selfsubjectaccessreviews",
		func(action k8stesting.Action) (bool, runtime.Object, error) {
			review := action.(k8stesting.CreateAction).GetObject().(*auth_v1.SelfSubjectAccessReview)
			attrs := review.Spec.ResourceAttributes
			// bookinfo allows list but denies watch; istio-system allows both.
			review.Status.Allowed = attrs.Namespace == "istio-system" || (attrs.Namespace == "bookinfo" && attrs.Verb == "list")
			return true, review, nil
		})
	factory := kubetest.NewFakeClientFactory(conf, map[string]kubernetes.UserClientInterface{"west": client})

	denied, err := newAccessCheck(conf, factory)(context.Background(), "west", "apps", "deployments")
	require.NoError(t, err)
	require.False(t, denied.Cluster)
	require.Equal(t, []string{"bookinfo"}, denied.Namespaces, "watch alone is enough to deny the namespace")
}

// An empty accessible-namespace list without cluster-wide access trivially returns
// allowed - there is nothing to revoke. Pinned as a known edge.
func TestAccessCheckEmptyAccessibleListIsAllowed(t *testing.T) {
	conf := config.NewConfig()
	conf.Deployment.ClusterWideAccess = false
	conf.Deployment.AccessibleNamespaces = []string{}
	client := fakeClientWithAccess(map[string]bool{})
	factory := kubetest.NewFakeClientFactory(conf, map[string]kubernetes.UserClientInterface{"west": client})

	denied, err := newAccessCheck(conf, factory)(context.Background(), "west", "apps", "deployments")
	require.NoError(t, err)
	require.False(t, denied.Cluster)
	require.Empty(t, denied.Namespaces)
}

// The remote caches' namespace restriction and the live access check must sweep the same
// namespaces in every configuration: the check must never evaluate a cluster against
// namespaces its cache was not scoped to. The swept namespaces are observed through the
// SSAR requests the check issues.
func TestRemoteCacheScopeMatchesAccessCheck(t *testing.T) {
	newConf := func() *config.Config {
		conf := config.NewConfig()
		conf.Deployment.ClusterWideAccess = false
		conf.Deployment.AccessibleNamespaces = []string{"bookinfo", "istio-system"}
		conf.Deployment.DiscoverySelectors.Default = config.DiscoverySelectorsType{
			&config.DiscoverySelectorType{MatchLabels: map[string]string{"kubernetes.io/metadata.name": "bookinfo"}},
		}
		conf.Deployment.DiscoverySelectors.Overrides = map[string]config.DiscoverySelectorsType{
			"valid": {
				&config.DiscoverySelectorType{MatchLabels: map[string]string{"kubernetes.io/metadata.name": "west-ns"}},
			},
			"unresolvable": {
				&config.DiscoverySelectorType{MatchLabels: map[string]string{"team": "west"}},
			},
		}
		return conf
	}

	tests := map[string]struct {
		cluster      string
		cwa          bool
		wantSwept    []string // namespaces the check must sweep; "" means cluster-wide
		wantScopedTo []string // keys of the cache's DefaultNamespaces; nil means no restriction
	}{
		"cluster-wide access has no scope and sweeps cluster-wide": {
			cluster: "valid", cwa: true, wantSwept: []string{""}, wantScopedTo: nil,
		},
		"a valid override scopes both the cache and the check": {
			cluster: "valid", wantSwept: []string{"west-ns"}, wantScopedTo: []string{"west-ns"},
		},
		"an unresolvable override falls back to the default list for both": {
			cluster: "unresolvable", wantSwept: []string{"bookinfo", "istio-system"}, wantScopedTo: []string{"bookinfo", "istio-system"},
		},
		"a cluster without an override uses the default list for both": {
			cluster: "east", wantSwept: []string{"bookinfo", "istio-system"}, wantScopedTo: []string{"bookinfo", "istio-system"},
		},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			conf := newConf()
			conf.Deployment.ClusterWideAccess = tc.cwa

			var mu sync.Mutex
			asked := []string{}
			client := recordingSSARClient(map[string]bool{}, &asked, &mu)
			factory := kubetest.NewFakeClientFactory(conf, map[string]kubernetes.UserClientInterface{tc.cluster: client})

			_, err := newAccessCheck(conf, factory)(context.Background(), tc.cluster, "apps", "deployments")
			require.NoError(t, err)

			mu.Lock()
			swept := slices.Clone(asked)
			mu.Unlock()
			// Each namespace is asked once per verb (list and watch): compare the sorted, deduped set.
			slices.Sort(swept)
			swept = slices.Compact(swept)
			require.Equal(t, tc.wantSwept, swept, "the check swept the expected namespaces")

			scopedTo := cacheNamespaces(conf, tc.cluster)
			if tc.wantScopedTo == nil {
				require.Nil(t, scopedTo, "no namespace restriction")
			} else {
				got := make([]string, 0, len(scopedTo))
				for namespace := range scopedTo {
					got = append(got, namespace)
				}
				slices.Sort(got)
				require.Equal(t, tc.wantScopedTo, got, "the cache is scoped to the same namespaces the check sweeps")
			}
		})
	}
}

// fakeTearingCache records which informer types it was asked to remove. Every other
// method panics: the watch error handler only calls RemoveInformer.
type fakeTearingCache struct {
	ctrlcache.Cache
	removed []string
}

func (f *fakeTearingCache) RemoveInformer(_ context.Context, obj ctrlclient.Object) error {
	f.removed = append(f.removed, fmt.Sprintf("%T", obj))
	return nil
}

// The teardown loop: which errors remove informers, and which types get removed.
func TestWatchErrorHandlerTeardown(t *testing.T) {
	forbidden := fmt.Errorf("failed to list *v1.Deployment: %w",
		apierrors.NewForbidden(schema.GroupResource{Group: "apps", Resource: "deployments"}, "", errors.New("denied")))
	noDetails := &apierrors.StatusError{ErrStatus: metav1.Status{Code: 403, Reason: "Forbidden"}}

	tests := map[string]struct {
		err            error
		access         *cache.ClusterAccess
		wantRemovals   int
		wantLogOverlap bool
	}{
		"a Forbidden error when access is still allowed keeps the cache": {
			err: forbidden, wantRemovals: 0,
		},
		"a Forbidden error with a confirmed revocation tears the cache down": {
			err: forbidden, wantRemovals: 23,
		},
		"a Forbidden error with a nil clusterAccess tears the cache down (legacy path)": {
			err: forbidden, wantRemovals: 23,
		},
		"a non-Forbidden error is ignored": {
			err: errors.New("connection refused"), wantRemovals: 0,
		},
		"a Forbidden error with no Details cannot name a resource and keeps the cache": {
			err: noDetails, wantRemovals: 0,
		},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			client := kubetest.NewFakeK8sClient()
			access := cache.NewClusterAccess(func(_ context.Context, _, _, _ string) (cache.DeniedAccess, error) {
				if tc.wantRemovals > 0 && tc.err == forbidden {
					return cache.DeniedAccess{Cluster: true}, nil
				}
				return cache.DeniedAccess{}, nil
			})
			if name == "a Forbidden error with a nil clusterAccess tears the cache down (legacy path)" {
				access = nil
			}
			fakeCache := &fakeTearingCache{}
			handler := makeWatchErrorHandler(func() ctrlcache.Cache { return fakeCache }, client, access)
			handler(context.Background(), nil, tc.err)
			require.Len(t, fakeCache.removed, tc.wantRemovals)
			if tc.wantRemovals > 0 {
				require.Contains(t, fakeCache.removed, "*v1.Deployment")
				require.Contains(t, fakeCache.removed, "*v1.Pod")
			}
		})
	}
}

// The startup sweep seeds revocation marks before any read exists to stall: a namespace
// already denied at startup (e.g. deleted before the restart) would otherwise only get
// marked after the first read creates an informer for it - an informer that never syncs,
// stalling that read for the full cache timeout.
func TestSeedRevokedAtStartup(t *testing.T) {
	conf := config.NewConfig()
	conf.Deployment.ClusterWideAccess = false
	conf.Deployment.AccessibleNamespaces = []string{"bookinfo", "istio-system"}
	client := fakeClientWithAccess(map[string]bool{
		"istio-system/apps/deployments/list":  true,
		"istio-system/apps/deployments/watch": true,
		"istio-system//pods/list":             true,
		"istio-system//pods/watch":            true,
	})
	factory := kubetest.NewFakeClientFactory(conf, map[string]kubernetes.UserClientInterface{"west": client})
	clusterAccess := cache.NewClusterAccess(newAccessCheck(conf, factory))

	seedRevokedAtStartup(context.Background(), clusterAccess, factory)

	require.Equal(t, []string{"bookinfo"}, clusterAccess.RevokedNamespaces("west"), "the denied namespace is marked before any read")
	_, degraded := clusterAccess.DegradedSince("west")
	require.False(t, degraded, "a cluster with readable namespaces is not degraded")
}
