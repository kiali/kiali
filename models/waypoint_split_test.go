package models

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
)

func TestResolveWaypointTrafficSplitNamespaceCanary(t *testing.T) {
	labels := map[string]string{
		config.WaypointUseLabel:       "waypoint",
		config.WaypointCanaryUseLabel: "waypoint-v2",
	}
	annotations := map[string]string{
		config.WaypointCanaryWeightAnnotation: "30",
	}
	split := ResolveWaypointTrafficSplit("cluster-default", "bookinfo", labels, annotations, "namespace")
	assert.NotNil(t, split)
	assert.Equal(t, "waypoint", split.Primary.Name)
	assert.NotNil(t, split.Canary)
	assert.Equal(t, "waypoint-v2", split.Canary.Name)
	assert.Equal(t, 30, split.CanaryWeight)
	assert.Equal(t, 70, split.PrimaryWeight)
}

func TestPickGatewayWaypointTrafficSplitPrefersCanary(t *testing.T) {
	primaryOnly := &WaypointTrafficSplit{
		ConfigLevel:   "namespace",
		PrimaryWeight: 100,
		Primary:       WaypointBinding{Name: "waypoint", Namespace: "infra", Role: WaypointRolePrimary},
	}
	canaryNoWeight := &WaypointTrafficSplit{
		ConfigLevel:   "namespace",
		CanaryWeight:  0,
		PrimaryWeight: 100,
		Primary:       WaypointBinding{Name: "waypoint", Namespace: "infra", Role: WaypointRolePrimary},
		Canary:        &WaypointBinding{Name: "waypoint-v2", Namespace: "infra", Role: WaypointRoleCanary},
	}
	withCanaryWeight := &WaypointTrafficSplit{
		ConfigLevel:   "service",
		CanaryWeight:  30,
		PrimaryWeight: 70,
		Primary:       WaypointBinding{Name: "waypoint", Namespace: "infra", Role: WaypointRolePrimary},
		Canary:        &WaypointBinding{Name: "waypoint-v2", Namespace: "infra", Role: WaypointRoleCanary},
	}
	picked := PickGatewayWaypointTrafficSplit([]*WaypointTrafficSplit{primaryOnly, canaryNoWeight, withCanaryWeight})
	assert.Equal(t, withCanaryWeight, picked)
}

func TestPickGatewayWaypointTrafficSplitPrefersServiceOnScoreTie(t *testing.T) {
	nsSplit := &WaypointTrafficSplit{
		ConfigLevel:   "namespace",
		CanaryWeight:  0,
		PrimaryWeight: 100,
		Primary:       WaypointBinding{Name: "waypoint", Namespace: "infra", Role: WaypointRolePrimary},
		Canary:        &WaypointBinding{Name: "waypoint-v2", Namespace: "infra", Role: WaypointRoleCanary},
	}
	svcSplit := &WaypointTrafficSplit{
		ConfigLevel:   "service",
		CanaryWeight:  0,
		PrimaryWeight: 100,
		Primary:       WaypointBinding{Name: "waypoint", Namespace: "infra", Role: WaypointRolePrimary},
		Canary:        &WaypointBinding{Name: "waypoint-v2", Namespace: "infra", Role: WaypointRoleCanary},
	}
	picked := PickGatewayWaypointTrafficSplit([]*WaypointTrafficSplit{nsSplit, svcSplit})
	assert.Equal(t, svcSplit, picked)
	picked = PickGatewayWaypointTrafficSplit([]*WaypointTrafficSplit{svcSplit, nsSplit})
	assert.Equal(t, svcSplit, picked)
}

func TestWaypointCanaryNodeLabel(t *testing.T) {
	split := &WaypointTrafficSplit{
		CanaryWeight:  30,
		PrimaryWeight: 70,
		Primary:       WaypointBinding{Name: "waypoint", Namespace: "bookinfo", Role: WaypointRolePrimary},
		Canary:        &WaypointBinding{Name: "waypoint-v2", Namespace: "bookinfo", Role: WaypointRoleCanary},
	}
	assert.Equal(t, "Canary 30%", WaypointCanaryNodeLabel("waypoint-v2", "bookinfo", split))
}

func TestParseWaypointCanaryWeightInvalid(t *testing.T) {
	assert.Equal(t, -1, ParseWaypointCanaryWeight(map[string]string{config.WaypointCanaryWeightAnnotation: "101"}))
	assert.Equal(t, 0, ParseWaypointCanaryWeight(map[string]string{}))
}
