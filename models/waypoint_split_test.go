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

func TestParseWaypointCanaryWeightInvalid(t *testing.T) {
	assert.Equal(t, -1, ParseWaypointCanaryWeight(map[string]string{config.WaypointCanaryWeightAnnotation: "101"}))
	assert.Equal(t, 0, ParseWaypointCanaryWeight(map[string]string{}))
}
