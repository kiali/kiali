package kubernetes

import (
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/meta"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
)

func TestFilterPodsForEndpoints(t *testing.T) {
	assert := assert.New(t)

	endpoints := core_v1.Endpoints{
		Subsets: []core_v1.EndpointSubset{
			{
				Addresses: []core_v1.EndpointAddress{
					{
						TargetRef: &core_v1.ObjectReference{
							Name: "pod-1",
							Kind: "Pod",
						},
					},
					{
						TargetRef: &core_v1.ObjectReference{
							Name: "pod-2",
							Kind: "Pod",
						},
					},
					{
						TargetRef: &core_v1.ObjectReference{
							Name: "other",
							Kind: "Other",
						},
					},
					{},
				},
			},
			{
				Addresses: []core_v1.EndpointAddress{
					{
						TargetRef: &core_v1.ObjectReference{
							Name: "pod-3",
							Kind: "Pod",
						},
					},
				},
			},
		},
	}

	pods := []core_v1.Pod{
		{ObjectMeta: meta_v1.ObjectMeta{Name: "pod-1"}},
		{ObjectMeta: meta_v1.ObjectMeta{Name: "pod-2"}},
		{ObjectMeta: meta_v1.ObjectMeta{Name: "pod-3"}},
		{ObjectMeta: meta_v1.ObjectMeta{Name: "pod-999"}},
		{ObjectMeta: meta_v1.ObjectMeta{Name: "other"}},
	}

	filtered := FilterPodsByEndpoints(&endpoints, pods)
	assert.Len(filtered, 3)
	assert.Equal("pod-1", filtered[0].Name)
	assert.Equal("pod-2", filtered[1].Name)
	assert.Equal("pod-3", filtered[2].Name)
}

func TestFilterGateways(t *testing.T) {
	assert := assert.New(t)

	vs1 := networking_v1beta1.VirtualService{}
	vs1.Name = "reviews"
	vs1.Namespace = "bookinfo"
	vs1.Spec.Hosts = []string{"reviews"}
	vs1.Spec.Gateways = []string{"bookinfo/gateway1", "bookinfo2/gateway2", "wronggateway", "bookinfo2/wronggateway2"}

	vs2 := networking_v1beta1.VirtualService{}
	vs2.Name = "ratings"
	vs2.Namespace = "bookinfo"
	vs2.Spec.Hosts = []string{"ratings"}
	vs2.Spec.Gateways = []string{"gateway4", "gateway2"}

	vs3 := networking_v1beta1.VirtualService{}
	vs3.Name = "details"
	vs3.Namespace = "bookinfo"
	vs3.Spec.Hosts = []string{"details"}
	vs3.Spec.Gateways = []string{"gateway1", "bookinfo3/gateway3", "wronggateway2"}

	virtualServices := []*networking_v1beta1.VirtualService{&vs1, &vs2, &vs3}

	gw1 := networking_v1beta1.Gateway{}
	gw1.Name = "gateway1"
	gw1.Namespace = "bookinfo"

	gw2 := networking_v1beta1.Gateway{}
	gw2.Name = "gateway2"
	gw2.Namespace = "bookinfo2"

	gw3 := networking_v1beta1.Gateway{}
	gw3.Name = "gateway3"
	gw3.Namespace = "bookinfo3"

	gw4 := networking_v1beta1.Gateway{}
	gw4.Name = "gateway4"
	gw4.Namespace = "bookinfo"

	gw5 := networking_v1beta1.Gateway{}
	gw5.Name = "gateway5"
	gw5.Namespace = "bookinfo2"

	gateways := []*networking_v1beta1.Gateway{&gw1, &gw2, &gw3, &gw4, &gw5}

	filtered := FilterGatewaysByVirtualServices(gateways, virtualServices)
	assert.Len(filtered, 4)
	assert.Equal("gateway1", filtered[0].Name)
	assert.Equal("gateway2", filtered[1].Name)
	assert.Equal("gateway3", filtered[2].Name)
	assert.Equal("gateway4", filtered[3].Name)
}

// ownerRefFrom generates an owner ref for the owner object. owner obj needs to have
// ObjectMeta and TypeMeta set to be a valid ref.
func ownerRefFrom(t *testing.T, owner runtime.Object) meta_v1.OwnerReference {
	t.Helper()
	m, err := meta.Accessor(owner)
	if err != nil {
		t.Fatal(err)
	}

	gvk := owner.GetObjectKind().GroupVersionKind()

	return *meta_v1.NewControllerRef(m, gvk)
}

func TestFilterPodsByController(t *testing.T) {
	rs := &apps_v1.ReplicaSet{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "Testing-RS",
			UID:  types.UID("e07b722f-c922-4046-8d98-7aa8487d41c1"),
		},
		TypeMeta: meta_v1.TypeMeta{
			Kind:       "ReplicaSet",
			APIVersion: apps_v1.SchemeGroupVersion.String(),
		},
	}
	cases := map[string]struct {
		controllerName string
		controllerType string
		pods           []core_v1.Pod
		expectedLen    int
	}{
		"Filters by kind and full name": {
			controllerName: rs.Name,
			controllerType: "ReplicaSet",
			pods: []core_v1.Pod{
				{
					ObjectMeta: meta_v1.ObjectMeta{
						Name:            "rs-pod-1",
						OwnerReferences: []meta_v1.OwnerReference{ownerRefFrom(t, rs)},
					},
				},
				{
					ObjectMeta: meta_v1.ObjectMeta{
						Name: "rs-pod-2",
					},
				},
			},
			expectedLen: 1,
		},
		"Includes APIVersion": {
			controllerName: rs.Name,
			controllerType: "ReplicaSet",
			pods: []core_v1.Pod{
				{
					ObjectMeta: meta_v1.ObjectMeta{
						Name: "rs-pod-1",
						OwnerReferences: func() []meta_v1.OwnerReference {
							badAPIVersionRS := rs.DeepCopy()
							badAPIVersionRS.APIVersion = "strange.group.io/v10"
							return []meta_v1.OwnerReference{ownerRefFrom(t, badAPIVersionRS)}
						}(),
					},
				},
			},
			// TODO: This should be 0
			expectedLen: 1,
		},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			assert := assert.New(t)

			pods := FilterPodsByController(tc.controllerName, tc.controllerType, tc.pods)
			assert.Equal(tc.expectedLen, len(pods))
		})
	}
}

func TestFilterRegistryServicesBySelector(t *testing.T) {
	assert := assert.New(t)

	selector := labels.SelectorFromSet(labels.Set(map[string]string{"app": "details"}))

	rs1 := CreateFakeRegistryService("details.bookinfo", "bookinfo", ".", map[string]string{"app": "details"})
	rs2 := CreateFakeRegistryService("reviews.bookinfo", "bookinfo2", "*", map[string]string{"app": "reviews", "version": "v1"})
	rs3 := CreateFakeRegistryService("ratings.bookinfo", "bookinfo3", "bookinfo", map[string]string{"app": "ratings", "version": "v1"})
	rs4 := CreateFakeRegistryService("details.bookinfo2", "bookinfo", "*", map[string]string{"app": "details2"})
	rs5 := CreateFakeRegistryService("details.bookinfo", "bookinfo2", "bookinfo", map[string]string{})
	rs6 := CreateFakeRegistryService("details.bookinfo3", "bookinfo3", "bookinfo2", map[string]string{"app": "details"})
	rs7 := CreateFakeRegistryService("details.bookinfo", "bookinfo", ".", map[string]string{"app": "details"})
	rs8 := CreateFakeRegistryService("details.bookinfo", "bookinfo2", "bookinfo", map[string]string{"app": "details"})
	rs9 := CreateFakeRegistryService("details.bookinfo2", "bookinfo2", "", map[string]string{"app": "details"})

	registryServices := []*RegistryService{rs1, rs2, rs3, rs4, rs5, rs6, rs7, rs8, rs9}

	filtered := FilterRegistryServicesBySelector(selector, "bookinfo", registryServices)
	assert.Len(filtered, 3)
	assert.Equal(rs1, filtered[0])
	assert.Equal(rs7, filtered[1])
	assert.Equal(rs8, filtered[2])
}

func CreateFakeRegistryService(host string, namespace string, exportToNamespace string, labels map[string]string) *RegistryService {
	registryService := RegistryService{}
	registryService.Hostname = host
	registryService.IstioService.Attributes.Namespace = namespace
	registryService.IstioService.Attributes.Labels = labels
	registryService.IstioService.Attributes.ExportTo = make(map[string]StructOrBool)
	registryService.IstioService.Attributes.ExportTo[exportToNamespace] = struct{}{}

	return &registryService
}
