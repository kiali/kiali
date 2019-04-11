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
