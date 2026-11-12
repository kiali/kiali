//go:build !exclude_frontend

package cmd

import (
	"context"
	"errors"
	"fmt"
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

	allowed, err := check(context.Background(), "west", "apps", "deployments")
	require.NoError(t, err)
	require.True(t, allowed)

	allowed, err = check(context.Background(), "west", "", "pods")
	require.NoError(t, err)
	require.False(t, allowed, "watch on pods is not allowed")

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

	allowed, err := newAccessCheck(conf, factory)(context.Background(), "west", "apps", "deployments")
	require.NoError(t, err)
	require.True(t, allowed, "every accessible namespace is readable")

	// A single denied namespace is not a revocation: the namespace may have been
	// deleted (its Role dies with it) or individually revoked, and the cluster
	// keeps serving the namespaces that are still readable.
	conf.Deployment.AccessibleNamespaces = append(conf.Deployment.AccessibleNamespaces, "other")
	allowed, err = newAccessCheck(conf, factory)(context.Background(), "west", "apps", "deployments")
	require.NoError(t, err)
	require.True(t, allowed, "a denied namespace alongside readable ones does not revoke the cluster")

	// The cluster is revoked only when no accessible namespace grants the read.
	denyingClient := fakeClientWithAccess(map[string]bool{})
	denyingFactory := kubetest.NewFakeClientFactory(conf, map[string]kubernetes.UserClientInterface{"west": denyingClient})
	allowed, err = newAccessCheck(conf, denyingFactory)(context.Background(), "west", "apps", "deployments")
	require.NoError(t, err)
	require.False(t, allowed, "every accessible namespace denied")
}

// A real SSAR API error must surface as (false, err) - unknown - never (false, nil) -
// denied: mapping API errors to "denied" would tear down healthy-but-slow clusters,
// the exact failure the three-valued check outcome exists to prevent.
//
// Known race, accepted: when one namespace's check errors and another's is denied, the
// errgroup returns whichever finished first, so a definitive denial can be reported as
// unknown. That outcome is bounded by the debounce window (10s) and conservative (the
// cache is kept and the check retried). Do not write a timing assertion for this - it
// would be flaky in CI.
// TestAccessibleNamespacesForClusterFallbacks pins the misconfiguration safety net of
// the access scoping: this function feeds both the remote cache's DefaultNamespaces and
// the access check, so a fallback that returned nil on error would give the remote cache
// no namespace restriction, and a check against zero namespaces trivially returns
// allowed - revocations would never be detected.
func TestAccessibleNamespacesForClusterFallbacks(t *testing.T) {
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
		"empty": {},
	}
	defaultList := []string{"bookinfo", "istio-system"}

	tests := map[string]struct {
		cluster  string
		cwa      bool
		expected []string
	}{
		"cluster without an override uses the default accessible namespaces": {
			cluster: "east", expected: defaultList,
		},
		"a valid override resolves to its own namespaces": {
			cluster: "valid", expected: []string{"west-ns"},
		},
		"an override that cannot be resolved falls back to the default list": {
			cluster: "unresolvable", expected: defaultList,
		},
		"an override that resolves to an empty list falls back to the default list": {
			cluster: "empty", expected: defaultList,
		},
		"cluster-wide access has no per-cluster scope": {
			cluster: "valid", cwa: true, expected: nil,
		},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			conf.Deployment.ClusterWideAccess = tc.cwa
			require.Equal(t, tc.expected, accessibleNamespacesForCluster(conf, tc.cluster))
		})
	}
}

func TestNamespaceConfigs(t *testing.T) {
	tests := map[string]struct {
		namespaces []string
		expected   map[string]ctrlcache.Config
	}{
		"a nil list means no restriction":    {namespaces: nil, expected: nil},
		"an empty list means no restriction": {namespaces: []string{}, expected: nil},
		"each namespace gets an empty config": {
			namespaces: []string{"bookinfo", "istio-system"},
			expected:   map[string]ctrlcache.Config{"bookinfo": {}, "istio-system": {}},
		},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			require.Equal(t, tc.expected, namespaceConfigs(tc.namespaces))
		})
	}
}

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

	allowed, err := check(context.Background(), "west", "apps", "deployments")
	require.Error(t, err)
	require.False(t, allowed)

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

	allowed, err := check(context.Background(), "west", "apps", "deployments")
	require.NoError(t, err)
	require.True(t, allowed, "the overridden cluster is verified against its override namespaces only")

	// A cluster without an override is verified against the default accessible namespaces.
	allowed, err = check(context.Background(), "east", "apps", "deployments")
	require.NoError(t, err)
	require.True(t, allowed)

	// Revoking the override namespace denies the overridden cluster.
	westAllowed["west-ns/apps/deployments/watch"] = false
	allowed, err = check(context.Background(), "west", "apps", "deployments")
	require.NoError(t, err)
	require.False(t, allowed, "the overridden cluster is denied when its override namespaces are revoked")

	// The home cluster never uses overrides: the operator creates its Roles from the
	// default discovery selectors only, so its check stays on the default accessible
	// namespaces. The west client grants west-ns but not bookinfo, so a check that
	// consulted west's override would wrongly pass.
	westAllowed["west-ns/apps/deployments/watch"] = true
	conf.KubernetesConfig.ClusterName = "west"
	check = newAccessCheck(conf, factory)
	allowed, err = check(context.Background(), "west", "apps", "deployments")
	require.NoError(t, err)
	require.False(t, allowed, "the home cluster is checked against the default accessible namespaces, not its override")
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
		return cache.NewClusterAccess(func(_ context.Context, c, g, r string) (bool, error) {
			gotCluster, gotGroup, gotResource = c, g, r
			return allowed, nil
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
