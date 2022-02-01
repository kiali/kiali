package business

import (
	"context"
	"testing"

	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/tests/data"
)

func TestGetVSReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	vs := mockCombinedReferencesService()

	references, _ := vs.GetIstioObjectReferences(context.TODO(), "test", kubernetes.VirtualServices, "product-vs")
	// Check Service references
	assert.NotEmpty(references.ServiceReferences)
	assert.Len(references.ServiceReferences, 2)
	assert.Equal(references.ServiceReferences[0].Name, "product")
	assert.Equal(references.ServiceReferences[0].Namespace, "test")
	assert.Equal(references.ServiceReferences[1].Name, "product2")
	assert.Equal(references.ServiceReferences[1].Namespace, "test")
}

func TestGetVSReferencesNotExisting(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	vs := mockCombinedReferencesService()

	references, err := vs.GetIstioObjectReferences(context.TODO(), "wrong", "virtualservices", "wrong")

	assert.NotNil(err)
	assert.Empty(references.ServiceReferences)
}

func mockCombinedReferencesService() IstioReferencesService {
	k8s := new(kubetest.K8SClientMock)

	fakeIstioObjects := []runtime.Object{}
	istioConfigList := fakeCombinedIstioConfigList()
	istioConfigList.VirtualServices = []networking_v1alpha3.VirtualService{*fakeVirtualService()}
	for _, v := range istioConfigList.VirtualServices {
		fakeIstioObjects = append(fakeIstioObjects, v.DeepCopyObject())
	}
	k8s.MockIstio(fakeIstioObjects...)

	k8s.On("GetToken").Return("token")
	k8s.On("GetNamespace", mock.AnythingOfType("string")).Return(kubetest.FakeNamespace("test"), nil)
	k8s.On("IsOpenShift").Return(false)
	k8s.On("IsMaistraApi").Return(false)
	k8s.On("GetNamespaces", mock.AnythingOfType("string")).Return(fakeNamespaces(), nil)
	k8s.On("GetSelfSubjectAccessReview", mock.Anything, mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("[]string")).Return(fakeGetSelfSubjectAccessReview(), nil)

	setupGlobalMeshConfig()

	return IstioReferencesService{k8s: k8s, businessLayer: NewWithBackends(k8s, nil, nil)}
}

func fakeVirtualService() *networking_v1alpha3.VirtualService {
	return data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("product", "v1", -1),
		data.AddTcpRoutesToVirtualService(data.CreateTcpRoute("product2", "v1", -1),
			data.CreateEmptyVirtualService("product-vs", "test", []string{"product"})))
}
