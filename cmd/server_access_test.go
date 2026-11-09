//go:build !exclude_frontend

package cmd

// Assisted-by: Claude Code

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	auth_v1 "k8s.io/api/authorization/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
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
	require.True(t, allowed)

	conf.Deployment.AccessibleNamespaces = append(conf.Deployment.AccessibleNamespaces, "other")
	allowed, err = newAccessCheck(conf, factory)(context.Background(), "west", "apps", "deployments")
	require.NoError(t, err)
	require.False(t, allowed, "no access in one of the namespaces")
}

func TestWatchErrorHandlerKeepsInformersOnTransientForbidden(t *testing.T) {
	forbidden := fmt.Errorf("failed to list *v1.Deployment: %w",
		apierrors.NewForbidden(schema.GroupResource{Group: "apps", Resource: "deployments"}, "", errors.New("denied")))
	client := kubetest.NewFakeK8sClient()
	cluster := client.ClusterInfo().Name

	readable := true
	access := cache.NewClusterAccess(func(context.Context, string, string, string) (bool, error) {
		return readable, nil
	})
	teardowns := 0
	handler := makeWatchErrorHandler(func() ctrlcache.Cache {
		teardowns++
		return nil
	}, client, access)

	handler(context.Background(), nil, forbidden)
	require.Zero(t, teardowns, "a forbidden error on a readable resource keeps the cache")
	_, degraded := access.DegradedSince(cluster)
	require.False(t, degraded)

	readable = false
	access = cache.NewClusterAccess(func(context.Context, string, string, string) (bool, error) {
		return readable, nil
	})
	handler = makeWatchErrorHandler(func() ctrlcache.Cache {
		teardowns++
		return nil
	}, client, access)
	handler(context.Background(), nil, forbidden)
	require.Equal(t, 1, teardowns, "a confirmed revocation tears the cache down")
	_, degraded = access.DegradedSince(cluster)
	require.True(t, degraded)
}
