package kubernetes

import (
	"testing"

	"github.com/stretchr/testify/assert"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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

	filtered := FilterPodsForEndpoints(&endpoints, pods)
	assert.Len(filtered, 3)
	assert.Equal("pod-1", filtered[0].Name)
	assert.Equal("pod-2", filtered[1].Name)
	assert.Equal("pod-3", filtered[2].Name)
}

func TestFilterGateways(t *testing.T) {
	assert := assert.New(t)

	virtualServices := []IstioObject{
		&GenericIstioObject{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:        "reviews",
				Namespace:   "bookinfo",
				ClusterName: "svc.cluster.local",
			},
			Spec: map[string]interface{}{
				"hosts":    []interface{}{"reviews"},
				"gateways": []interface{}{"bookinfo/gateway1", "bookinfo2/gateway2", "wronggateway", "bookinfo2/wronggateway2"},
			},
		},
		&GenericIstioObject{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:        "ratings",
				Namespace:   "bookinfo",
				ClusterName: "svc.cluster.local",
			},
			Spec: map[string]interface{}{
				"hosts":    []interface{}{"ratings"},
				"gateways": []interface{}{"gateway4", "gateway2"},
			},
		},
		&GenericIstioObject{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:        "details",
				Namespace:   "bookinfo",
				ClusterName: "svc.cluster.local",
			},
			Spec: map[string]interface{}{
				"hosts":    []interface{}{"details"},
				"gateways": []interface{}{"gateway1", "bookinfo3/gateway3", "wronggateway2"},
			},
		},
	}

	gateways := []IstioObject{
		&GenericIstioObject{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "gateway1",
				Namespace: "bookinfo",
			},
		},
		&GenericIstioObject{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "gateway2",
				Namespace: "bookinfo2",
			},
		},
		&GenericIstioObject{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "gateway3",
				Namespace: "bookinfo3",
			},
		},
		&GenericIstioObject{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "gateway4",
				Namespace: "bookinfo",
			},
		},
		&GenericIstioObject{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "gateway5",
				Namespace: "bookinfo2",
			},
		},
	}

	filtered := FilterGateways(gateways, virtualServices)
	assert.Len(filtered, 4)
	assert.Equal("gateway1", filtered[0].GetObjectMeta().Name)
	assert.Equal("gateway2", filtered[1].GetObjectMeta().Name)
	assert.Equal("gateway3", filtered[2].GetObjectMeta().Name)
	assert.Equal("gateway4", filtered[3].GetObjectMeta().Name)
}
