package list_or_get_resources

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

func TestExtractAmbientNetworking_WorkloadNotInDump(t *testing.T) {
	wl := &models.Workload{
		WorkloadListItem: models.WorkloadListItem{
			Name:      "test-workload",
			Namespace: "test-ns",
		},
	}

	dump := &kubernetes.ZtunnelConfigDump{
		Workloads: []kubernetes.Workload{
			{
				WorkloadName: "other-workload",
				Namespace:    "test-ns",
			},
		},
	}

	result := extractAmbientNetworking(wl, dump)
	assert.NotNil(t, result)
	assert.False(t, result.Captured, "Workload not in dump should not be captured")
}

func TestExtractAmbientNetworking_WorkloadCaptured(t *testing.T) {
	wl := &models.Workload{
		WorkloadListItem: models.WorkloadListItem{
			Name:      "test-workload",
			Namespace: "test-ns",
		},
	}

	dump := &kubernetes.ZtunnelConfigDump{
		Workloads: []kubernetes.Workload{
			{
				WorkloadName: "test-workload",
				Namespace:    "test-ns",
				Protocol:     "HBONE",
				NetworkMode:  "Standard",
				Status:       "Healthy",
				Node:         "worker-1",
				TrustDomain:  "cluster.local",
				Services:     []string{"svc1", "svc2"},
			},
		},
		Services: []kubernetes.Service{
			{
				Name:      "svc1",
				Namespace: "test-ns",
				Vips:      []string{"10.96.0.1"},
				Waypoint: kubernetes.Waypoint{
					Destination: "test-ns/waypoint",
				},
			},
			{
				Name:      "svc2",
				Namespace: "test-ns",
				Vips:      []string{"10.96.0.2"},
			},
		},
	}

	result := extractAmbientNetworking(wl, dump)
	assert.NotNil(t, result)
	assert.True(t, result.Captured)
	assert.Equal(t, "HBONE", result.Protocol)
	assert.Equal(t, "Standard", result.NetworkMode)
	assert.Equal(t, "Healthy", result.Status)
	assert.Equal(t, "worker-1", result.Node)
	assert.Equal(t, "cluster.local", result.TrustDomain)
	assert.Len(t, result.CapturedServices, 2)
	assert.Equal(t, "svc1", result.CapturedServices[0].Name)
	assert.Equal(t, "test-ns/waypoint", result.CapturedServices[0].Waypoint)
	assert.Equal(t, []string{"10.96.0.1"}, result.CapturedServices[0].Vips)
}

func TestExtractAmbientNetworking_NilDump(t *testing.T) {
	wl := &models.Workload{
		WorkloadListItem: models.WorkloadListItem{
			Name:      "test-workload",
			Namespace: "test-ns",
		},
	}

	result := extractAmbientNetworking(wl, nil)
	assert.Nil(t, result)
}

func TestContainsString(t *testing.T) {
	slice := []string{"foo", "bar", "baz"}

	assert.True(t, containsString(slice, "foo"))
	assert.True(t, containsString(slice, "bar"))
	assert.False(t, containsString(slice, "qux"))
	assert.False(t, containsString([]string{}, "foo"))
}
