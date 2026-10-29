package kubetest

/*
	Contains a fake user client that models a restricted user for namespace
	authorization tests.
*/

import (
	corev1 "k8s.io/api/core/v1"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	kubefake "k8s.io/client-go/kubernetes/fake"
	kubeclienttesting "k8s.io/client-go/testing"

	"github.com/kiali/kiali/kubernetes"
)

// NamespaceRestrictedClient is a fake user client that models a restricted
// user: its namespace LIST returns only the listed namespaces, and the
// per-namespace GET on any denied namespace returns Forbidden. The listed
// and denied sets are independent, so both profiles can be modeled:
//
//   - a restricted user:      listed = the allowed namespaces, denied = the victim
//   - a LIST-authorized user: listed = allowed + victim,     denied = the victim
//     (the #7125 profile: LIST includes the namespace, GET does not)
type NamespaceRestrictedClient struct {
	denied map[string]struct{}
	fake   *FakeK8sClient
	kubernetes.UserClientInterface
}

// FakeClient returns the wrapped fake client, so tests can reach its
// clientset (e.g. to prepend counting reactors) through the embedding.
func (c *NamespaceRestrictedClient) FakeClient() *FakeK8sClient {
	return c.fake
}

// NewNamespaceRestrictedClient wraps the given fake client. The client's
// CacheKey is set to cacheKey — it must differ from the SA token (and from
// other users' keys), or the accessible-set computation takes the
// SA-identity shortcut and serves the SA's unfiltered list.
//
// The namespaces stay in the fake itself: they exist (the SA can see them);
// only this user's LIST (and GET on the denied ones) is restricted. That is
// what makes a denial test exercise "exists but denied" rather than
// "absent" whenever the code under test consults the SA set.
func NewNamespaceRestrictedClient(k8s *FakeK8sClient, cacheKey string, listed []string, denied ...string) *NamespaceRestrictedClient {
	k8s.CacheKey = cacheKey
	listedNamespaces := make([]corev1.Namespace, 0, len(listed))
	for _, name := range listed {
		listedNamespaces = append(listedNamespaces, corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: name}})
	}
	if fakeClientset, ok := k8s.KubeClientset.(*kubefake.Clientset); ok {
		fakeClientset.PrependReactor("list", "namespaces", func(action kubeclienttesting.Action) (bool, runtime.Object, error) {
			return true, &corev1.NamespaceList{Items: listedNamespaces}, nil
		})
	}
	deniedSet := make(map[string]struct{}, len(denied))
	for _, name := range denied {
		deniedSet[name] = struct{}{}
	}
	return &NamespaceRestrictedClient{denied: deniedSet, fake: k8s, UserClientInterface: k8s}
}

func (c *NamespaceRestrictedClient) GetNamespace(name string) (*corev1.Namespace, error) {
	if _, ok := c.denied[name]; ok {
		return nil, ForbiddenNamespace(name)
	}
	return c.UserClientInterface.GetNamespace(name)
}

// ForbiddenNamespace returns the k8s Forbidden error the restricted fakes
// use for denied namespace GETs. The accessible-set computation
// distinguishes error kinds (a non-Forbidden error aborts the whole set
// computation), so fakes must return a real StatusError, not a plain error.
func ForbiddenNamespace(name string) error {
	return k8serrors.NewForbidden(schema.GroupResource{Group: "", Resource: "namespaces"}, name, nil)
}
