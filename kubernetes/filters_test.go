package kubernetes

import (
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/meta"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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

	vs1 := networking_v1alpha3.VirtualService{}
	vs1.Name = "reviews"
	vs1.Namespace = "bookinfo"
	vs1.ClusterName = "svc.cluster.local"
	vs1.Spec.Hosts = []string{"reviews"}
	vs1.Spec.Gateways = []string{"bookinfo/gateway1", "bookinfo2/gateway2", "wronggateway", "bookinfo2/wronggateway2"}

	vs2 := networking_v1alpha3.VirtualService{}
	vs2.Name = "ratings"
	vs2.Namespace = "bookinfo"
	vs2.ClusterName = "svc.cluster.local"
	vs2.Spec.Hosts = []string{"ratings"}
	vs2.Spec.Gateways = []string{"gateway4", "gateway2"}

	vs3 := networking_v1alpha3.VirtualService{}
	vs3.Name = "details"
	vs3.Namespace = "bookinfo"
	vs3.ClusterName = "svc.cluster.local"
	vs3.Spec.Hosts = []string{"details"}
	vs3.Spec.Gateways = []string{"gateway1", "bookinfo3/gateway3", "wronggateway2"}

	virtualServices := []networking_v1alpha3.VirtualService{vs1, vs2, vs3}

	gw1 := networking_v1alpha3.Gateway{}
	gw1.Name = "gateway1"
	gw1.Namespace = "bookinfo"

	gw2 := networking_v1alpha3.Gateway{}
	gw2.Name = "gateway2"
	gw2.Namespace = "bookinfo2"

	gw3 := networking_v1alpha3.Gateway{}
	gw3.Name = "gateway3"
	gw3.Namespace = "bookinfo3"

	gw4 := networking_v1alpha3.Gateway{}
	gw4.Name = "gateway4"
	gw4.Namespace = "bookinfo"

	gw5 := networking_v1alpha3.Gateway{}
	gw5.Name = "gateway5"
	gw5.Namespace = "bookinfo2"

	gateways := []networking_v1alpha3.Gateway{gw1, gw2, gw3, gw4, gw5}

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
