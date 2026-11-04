package business

import (
	"testing"

	"github.com/stretchr/testify/assert"
	core_v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
)

func TestWaypointTrafficSplitForServiceNoneOptOut(t *testing.T) {
	ns := &models.Namespace{
		Name: "bookinfo",
		Labels: map[string]string{
			config.WaypointUseLabel:       "waypoint",
			config.WaypointCanaryUseLabel: "waypoint-v2",
		},
		Annotations: map[string]string{
			config.WaypointCanaryWeightAnnotation: "30",
		},
	}
	svc := &models.Service{
		Namespace: "bookinfo",
		Labels: map[string]string{
			config.WaypointUseLabel: config.WaypointNone,
		},
	}
	assert.Nil(t, waypointTrafficSplitForService(svc, ns))
}

func TestWaypointTrafficSplitForServiceOverride(t *testing.T) {
	ns := &models.Namespace{
		Name: "bookinfo",
		Labels: map[string]string{
			config.WaypointUseLabel:       "waypoint",
			config.WaypointCanaryUseLabel: "waypoint-v2",
		},
		Annotations: map[string]string{
			config.WaypointCanaryWeightAnnotation: "30",
		},
	}
	svc := &models.Service{
		Namespace: "bookinfo",
		Labels: map[string]string{
			config.WaypointUseLabel:       "waypoint",
			config.WaypointCanaryUseLabel: "waypoint-v2",
		},
		Annotations: map[string]string{
			config.WaypointCanaryWeightAnnotation: "10",
		},
	}
	split := waypointTrafficSplitForService(svc, ns)
	assert.NotNil(t, split)
	assert.Equal(t, "service", split.ConfigLevel)
	assert.Equal(t, 10, split.CanaryWeight)
}

func TestWaypointRoleDisplayWeight(t *testing.T) {
	ns := core_v1.Namespace{
		ObjectMeta: metav1.ObjectMeta{
			Name: "bookinfo",
			Labels: map[string]string{
				config.WaypointCanaryUseLabel: "waypoint-v2",
			},
			Annotations: map[string]string{
				config.WaypointCanaryWeightAnnotation: "30",
			},
		},
	}
	labeled := []core_v1.Namespace{ns}

	assert.Equal(t, 0, waypointRoleDisplayWeight(models.WaypointRolePrimary, nil, nil, "other", labeled, 0))
	assert.Equal(t, 70, waypointRoleDisplayWeight(models.WaypointRolePrimary, nil, nil, "bookinfo", labeled, 0))
	assert.Equal(t, 30, waypointRoleDisplayWeight(models.WaypointRoleCanary, nil, nil, "bookinfo", labeled, -1))
}

func TestMergeWaypointServiceRefsPrefersCanaryWithWeight(t *testing.T) {
	primary := []models.ServiceReferenceInfo{{
		Cluster: "c", Name: "reviews", Namespace: "bookinfo", WaypointRole: models.WaypointRolePrimary, RoleWeight: 0,
	}}
	canary := []models.ServiceReferenceInfo{{
		Cluster: "c", Name: "reviews", Namespace: "bookinfo", WaypointRole: models.WaypointRoleCanary, RoleWeight: 30, CanaryWeight: 30,
	}}
	merged := mergeWaypointServiceRefs(primary, canary)
	assert.Len(t, merged, 1)
	assert.Equal(t, models.WaypointRoleCanary, merged[0].WaypointRole)
	assert.Equal(t, 30, merged[0].RoleWeight)
}

func TestWaypointEnrolledServiceRefResolvesNamespaceCanaryWeight(t *testing.T) {
	ns := core_v1.Namespace{
		ObjectMeta: metav1.ObjectMeta{
			Name: "bookinfo",
			Labels: map[string]string{
				config.WaypointCanaryUseLabel: "waypoint-v2",
			},
			Annotations: map[string]string{
				config.WaypointCanaryWeightAnnotation: "30",
			},
		},
	}
	svc := &models.ServiceOverview{
		Name:      "reviews",
		Namespace: "bookinfo",
		Cluster:   "c",
		Labels:    map[string]string{config.WaypointCanaryUseLabel: "waypoint-v2"},
	}
	ref := waypointEnrolledServiceRef(svc, "namespace", models.WaypointRoleCanary, -1, []core_v1.Namespace{ns})
	assert.Equal(t, 30, ref.CanaryWeight)
	assert.Equal(t, 30, ref.RoleWeight)
	assert.GreaterOrEqual(t, ref.CanaryWeight, 0)
}
