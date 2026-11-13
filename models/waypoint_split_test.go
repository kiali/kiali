// Assisted-by: Codex

package models

import (
	"fmt"
	"maps"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

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

func TestGatewayWaypointCanaryGraphLabelMultipleEnrollments(t *testing.T) {
	weightA := 10
	weightB := 30
	configs := []GatewayWaypointTrafficSplitConfig{
		{
			ConfigLevel: "namespace",
			Namespace:   "client-a",
			Split: &WaypointTrafficSplit{
				Canary:        &WaypointBinding{Name: "egress-gateway-canary", Namespace: "infra"},
				CanaryWeight:  weightA,
				Primary:       WaypointBinding{Name: "egress-gateway", Namespace: "infra"},
				PrimaryWeight: 100 - weightA,
			},
		},
		{
			ConfigLevel: "namespace",
			Namespace:   "client-b",
			Split: &WaypointTrafficSplit{
				Canary:        &WaypointBinding{Name: "egress-gateway-canary", Namespace: "infra"},
				CanaryWeight:  weightB,
				Primary:       WaypointBinding{Name: "egress-gateway", Namespace: "infra"},
				PrimaryWeight: 100 - weightB,
			},
		},
	}
	assert.Equal(t, "Canary "+WaypointCanaryMultipleSplitsLabel, GatewayWaypointCanaryGraphLabel(configs, "egress-gateway-canary", "infra"))
	assert.Equal(t, "Primary "+WaypointCanaryMultipleSplitsLabel, GatewayWaypointCanaryGraphLabel(configs, "egress-gateway", "infra"))
	assert.Equal(t, fmt.Sprintf("Canary %d%%", weightA), GatewayWaypointCanaryGraphLabel(configs[:1], "egress-gateway-canary", "infra"))
}

func TestPickGatewayWaypointTrafficSplitPrefersCanary(t *testing.T) {
	primaryOnly := &WaypointTrafficSplit{
		ConfigLevel:   "namespace",
		Primary:       WaypointBinding{Name: "waypoint", Namespace: "infra", Role: WaypointRolePrimary},
		PrimaryWeight: 100,
	}
	canaryNoWeight := &WaypointTrafficSplit{
		Canary:        &WaypointBinding{Name: "waypoint-v2", Namespace: "infra", Role: WaypointRoleCanary},
		CanaryWeight:  0,
		ConfigLevel:   "namespace",
		Primary:       WaypointBinding{Name: "waypoint", Namespace: "infra", Role: WaypointRolePrimary},
		PrimaryWeight: 100,
	}
	withCanaryWeight := &WaypointTrafficSplit{
		Canary:        &WaypointBinding{Name: "waypoint-v2", Namespace: "infra", Role: WaypointRoleCanary},
		CanaryWeight:  30,
		ConfigLevel:   "service",
		Primary:       WaypointBinding{Name: "waypoint", Namespace: "infra", Role: WaypointRolePrimary},
		PrimaryWeight: 70,
	}
	picked := PickGatewayWaypointTrafficSplit([]*WaypointTrafficSplit{primaryOnly, canaryNoWeight, withCanaryWeight})
	assert.Equal(t, withCanaryWeight, picked)
}

func TestPickGatewayWaypointTrafficSplitPrefersServiceOnScoreTie(t *testing.T) {
	nsSplit := &WaypointTrafficSplit{
		Canary:        &WaypointBinding{Name: "waypoint-v2", Namespace: "infra", Role: WaypointRoleCanary},
		CanaryWeight:  0,
		ConfigLevel:   "namespace",
		Primary:       WaypointBinding{Name: "waypoint", Namespace: "infra", Role: WaypointRolePrimary},
		PrimaryWeight: 100,
	}
	svcSplit := &WaypointTrafficSplit{
		Canary:        &WaypointBinding{Name: "waypoint-v2", Namespace: "infra", Role: WaypointRoleCanary},
		CanaryWeight:  0,
		ConfigLevel:   "service",
		Primary:       WaypointBinding{Name: "waypoint", Namespace: "infra", Role: WaypointRolePrimary},
		PrimaryWeight: 100,
	}
	picked := PickGatewayWaypointTrafficSplit([]*WaypointTrafficSplit{nsSplit, svcSplit})
	assert.Equal(t, svcSplit, picked)
	picked = PickGatewayWaypointTrafficSplit([]*WaypointTrafficSplit{svcSplit, nsSplit})
	assert.Equal(t, svcSplit, picked)
}

func TestWaypointCanaryNodeLabel(t *testing.T) {
	split := &WaypointTrafficSplit{
		Canary:        &WaypointBinding{Name: "waypoint-v2", Namespace: "bookinfo", Role: WaypointRoleCanary},
		CanaryWeight:  30,
		Primary:       WaypointBinding{Name: "waypoint", Namespace: "bookinfo", Role: WaypointRolePrimary},
		PrimaryWeight: 70,
	}
	assert.Equal(t, "Canary 30%", WaypointCanaryNodeLabel("waypoint-v2", "bookinfo", split))
}

func TestParseWaypointCanaryWeightInvalid(t *testing.T) {
	assert.Equal(t, -1, ParseWaypointCanaryWeight(map[string]string{config.WaypointCanaryWeightAnnotation: "101"}))
	assert.Equal(t, 0, ParseWaypointCanaryWeight(map[string]string{}))
}

func TestGatewayWaypointCanaryGraphLabelAgreements(t *testing.T) {
	makeConfig := func(namespace, level string, weight int) GatewayWaypointTrafficSplitConfig {
		return GatewayWaypointTrafficSplitConfig{
			ConfigLevel: level,
			Namespace:   namespace,
			Split: ResolveWaypointTrafficSplit("cluster-default", "infra", map[string]string{
				config.WaypointCanaryUseLabel: "canary",
				config.WaypointUseLabel:       "primary",
			}, map[string]string{
				config.WaypointCanaryWeightAnnotation: fmt.Sprintf("%d", weight),
			}, level),
		}
	}

	for name, tc := range map[string]struct {
		configs     []GatewayWaypointTrafficSplitConfig
		wantCanary  string
		wantPrimary string
	}{
		"matching namespace weights": {
			configs:     []GatewayWaypointTrafficSplitConfig{makeConfig("a", "namespace", 30), makeConfig("b", "namespace", 30)},
			wantCanary:  "Canary 30%",
			wantPrimary: "Primary 70%",
		},
		"matching namespace and service weights": {
			configs:     []GatewayWaypointTrafficSplitConfig{makeConfig("a", "namespace", 30), makeConfig("b", "service", 30)},
			wantCanary:  "Canary 30%",
			wantPrimary: "Primary 70%",
		},
		"matching zero weights": {
			configs:     []GatewayWaypointTrafficSplitConfig{makeConfig("a", "namespace", 0), makeConfig("b", "namespace", 0)},
			wantCanary:  "Canary 0%",
			wantPrimary: "Primary 100%",
		},
		"matching full weights": {
			configs:     []GatewayWaypointTrafficSplitConfig{makeConfig("a", "namespace", 100), makeConfig("b", "namespace", 100)},
			wantCanary:  "Canary 100%",
			wantPrimary: "Primary 0%",
		},
		"different weights": {
			configs:     []GatewayWaypointTrafficSplitConfig{makeConfig("a", "namespace", 10), makeConfig("b", "namespace", 30)},
			wantCanary:  "Canary " + WaypointCanaryMultipleSplitsLabel,
			wantPrimary: "Primary " + WaypointCanaryMultipleSplitsLabel,
		},
		"empty configuration": {
			configs:     []GatewayWaypointTrafficSplitConfig{{}, makeConfig("a", "namespace", 30), makeConfig("b", "namespace", 30)},
			wantCanary:  "Canary 30%",
			wantPrimary: "Primary 70%",
		},
	} {
		t.Run(name, func(t *testing.T) {
			assert.Equal(t, tc.wantCanary, GatewayWaypointCanaryGraphLabel(tc.configs, "canary", "infra"))
			assert.Equal(t, tc.wantPrimary, GatewayWaypointCanaryGraphLabel(tc.configs, "primary", "infra"))
		})
	}

	t.Run("matching percentage with different roles", func(t *testing.T) {
		primary := makeConfig("a", "namespace", 50)
		canary := makeConfig("b", "namespace", 50)
		canary.Split.Primary.Name = "canary"
		canary.Split.Canary.Name = "primary"
		configs := []GatewayWaypointTrafficSplitConfig{primary, canary}
		assert.Equal(t, WaypointCanaryMultipleSplitsLabel, GatewayWaypointCanaryGraphLabel(configs, "primary", "infra"))
		assert.Equal(t, WaypointCanaryMultipleSplitsLabel, GatewayWaypointCanaryGraphLabel(configs, "canary", "infra"))
	})
}

func TestResolveServiceWaypointTrafficSplitInheritance(t *testing.T) {
	for name, tc := range map[string]struct {
		annotations          map[string]string
		labels               map[string]string
		wantCanary           string
		wantCanaryNamespace  string
		wantLevel            string
		wantNil              bool
		wantPrimary          string
		wantPrimaryNamespace string
		wantWeight           int
	}{
		"namespace defaults":                              {wantCanary: "canary", wantCanaryNamespace: "infra", wantLevel: "namespace", wantPrimary: "primary", wantPrimaryNamespace: "infra", wantWeight: 30},
		"weight override":                                 {annotations: map[string]string{config.WaypointCanaryWeightAnnotation: "80"}, wantCanary: "canary", wantCanaryNamespace: "infra", wantLevel: "service", wantPrimary: "primary", wantPrimaryNamespace: "infra", wantWeight: 80},
		"zero override":                                   {annotations: map[string]string{config.WaypointCanaryWeightAnnotation: "0"}, wantCanary: "canary", wantCanaryNamespace: "infra", wantLevel: "service", wantPrimary: "primary", wantPrimaryNamespace: "infra"},
		"full promotion":                                  {annotations: map[string]string{config.WaypointCanaryWeightAnnotation: "100"}, wantCanary: "canary", wantCanaryNamespace: "infra", wantLevel: "service", wantPrimary: "primary", wantPrimaryNamespace: "infra", wantWeight: 100},
		"canary name resets its namespace":                {labels: map[string]string{config.WaypointCanaryUseLabel: "own"}, wantCanary: "own", wantCanaryNamespace: "bookinfo", wantLevel: "service", wantPrimary: "primary", wantPrimaryNamespace: "infra", wantWeight: 30},
		"cross namespace canary override":                 {labels: map[string]string{config.WaypointCanaryUseLabel: "own", config.WaypointCanaryNamespaceLabel: "other"}, wantCanary: "own", wantCanaryNamespace: "other", wantLevel: "service", wantPrimary: "primary", wantPrimaryNamespace: "infra", wantWeight: 30},
		"namespace without canary name does not override": {labels: map[string]string{config.WaypointCanaryNamespaceLabel: "other"}, wantCanary: "canary", wantCanaryNamespace: "infra", wantLevel: "namespace", wantPrimary: "primary", wantPrimaryNamespace: "infra", wantWeight: 30},
		"disable canary":                                  {labels: map[string]string{config.WaypointCanaryUseLabel: config.WaypointNone}, wantLevel: "service", wantPrimary: "primary", wantPrimaryNamespace: "infra"},
		"empty canary disables inheritance":               {labels: map[string]string{config.WaypointCanaryUseLabel: ""}, wantLevel: "service", wantPrimary: "primary", wantPrimaryNamespace: "infra"},
		"explicit primary disables canary inheritance":    {labels: map[string]string{config.WaypointUseLabel: "own"}, wantLevel: "service", wantPrimary: "own", wantPrimaryNamespace: "bookinfo"},
		"explicit primary disables weight inheritance":    {labels: map[string]string{config.WaypointUseLabel: "own", config.WaypointCanaryUseLabel: "own-canary"}, wantCanary: "own-canary", wantCanaryNamespace: "bookinfo", wantLevel: "service", wantPrimary: "own", wantPrimaryNamespace: "bookinfo"},
		"primary optout":                                  {labels: map[string]string{config.WaypointUseLabel: config.WaypointNone}, wantNil: true},
	} {
		t.Run(name, func(t *testing.T) {
			nsLabels := map[string]string{config.WaypointUseLabel: "primary", config.WaypointUseNamespaceLabel: "infra", config.WaypointCanaryUseLabel: "canary", config.WaypointCanaryNamespaceLabel: "infra"}
			nsAnnotations := map[string]string{config.WaypointCanaryWeightAnnotation: "30"}
			labelsBefore, annotationsBefore := maps.Clone(tc.labels), maps.Clone(tc.annotations)
			nsLabelsBefore, nsAnnotationsBefore := maps.Clone(nsLabels), maps.Clone(nsAnnotations)
			split := ResolveServiceWaypointTrafficSplit("cluster-default", "bookinfo", tc.labels, tc.annotations, nsLabels, nsAnnotations)
			assert.Equal(t, labelsBefore, tc.labels)
			assert.Equal(t, annotationsBefore, tc.annotations)
			assert.Equal(t, nsLabelsBefore, nsLabels)
			assert.Equal(t, nsAnnotationsBefore, nsAnnotations)
			if tc.wantNil {
				require.Nil(t, split)
				return
			}
			require.NotNil(t, split)
			assert.Equal(t, tc.wantPrimary, split.Primary.Name)
			assert.Equal(t, tc.wantPrimaryNamespace, split.Primary.Namespace)
			assert.Equal(t, tc.wantLevel, split.ConfigLevel)
			assert.Equal(t, tc.wantWeight, split.CanaryWeight)
			assert.Equal(t, 100-tc.wantWeight, split.PrimaryWeight)
			if tc.wantCanary == "" {
				require.Nil(t, split.Canary)
				return
			}
			require.NotNil(t, split.Canary)
			assert.Equal(t, tc.wantCanary, split.Canary.Name)
			assert.Equal(t, tc.wantCanaryNamespace, split.Canary.Namespace)
		})
	}
}
