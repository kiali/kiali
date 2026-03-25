package business

import (
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

func healthStatusMetricValue(t *testing.T, cluster, namespace string, healthType internalmetrics.HealthType, name string) (value float64, ok bool) {
	t.Helper()
	ch := make(chan prometheus.Metric, 64)
	internalmetrics.Metrics.HealthStatus.Collect(ch)
	close(ch)
	for m := range ch {
		var dm dto.Metric
		if err := m.Write(&dm); err != nil {
			t.Fatalf("metric Write: %v", err)
		}
		lbs := dtoLabelsToMap(dm.GetLabel())
		if lbs["cluster"] == cluster && lbs["namespace"] == namespace &&
			lbs["health_type"] == string(healthType) && lbs["name"] == name {
			return dm.GetGauge().GetValue(), true
		}
	}
	return 0, false
}

func dtoLabelsToMap(pairs []*dto.LabelPair) map[string]string {
	out := make(map[string]string, len(pairs))
	for _, lp := range pairs {
		if lp != nil && lp.Name != nil && lp.Value != nil {
			out[lp.GetName()] = lp.GetValue()
		}
	}
	return out
}

func deleteTestHealthStatus(t *testing.T, cluster, namespace string, healthType internalmetrics.HealthType, name string) {
	t.Helper()
	internalmetrics.DeleteHealthStatusForItem(cluster, namespace, healthType, name)
}

func testExporterConfig(enabled bool, maxConsecutiveNA int) *config.Config {
	c := config.NewConfig()
	c.Server.Observability.Metrics.HealthStatus.Enabled = enabled
	c.Server.Observability.Metrics.HealthStatus.MaxConsecutiveNA = maxConsecutiveNA
	return c
}

func TestHealthStatusExporter_Disabled(t *testing.T) {
	cluster := "TestHealthStatusExporter_Disabled"
	ns := "ns"
	name := "app1"
	defer deleteTestHealthStatus(t, cluster, ns, internalmetrics.HealthTypeApp, name)

	e := NewHealthStatusExporter(testExporterConfig(false, 3))
	e.Observe(cluster, ns, internalmetrics.HealthTypeApp, name, "Healthy")
	_, found := healthStatusMetricValue(t, cluster, ns, internalmetrics.HealthTypeApp, name)
	require.False(t, found)
}

func TestHealthStatusExporter_SetHealthy(t *testing.T) {
	cluster := "TestHealthStatusExporter_SetHealthy"
	ns := "ns"
	name := "svc1"
	defer deleteTestHealthStatus(t, cluster, ns, internalmetrics.HealthTypeService, name)

	e := NewHealthStatusExporter(testExporterConfig(true, 3))
	e.Observe(cluster, ns, internalmetrics.HealthTypeService, name, "Healthy")
	v, found := healthStatusMetricValue(t, cluster, ns, internalmetrics.HealthTypeService, name)
	require.True(t, found)
	require.InDelta(t, 0.0, v, 1e-9)
}

func TestHealthStatusExporter_SetNotReady(t *testing.T) {
	cluster := "TestHealthStatusExporter_SetNotReady"
	ns := "ns"
	name := "app1"
	defer deleteTestHealthStatus(t, cluster, ns, internalmetrics.HealthTypeApp, name)

	e := NewHealthStatusExporter(testExporterConfig(true, 3))
	e.Observe(cluster, ns, internalmetrics.HealthTypeApp, name, "Not Ready")
	v, found := healthStatusMetricValue(t, cluster, ns, internalmetrics.HealthTypeApp, name)
	require.True(t, found)
	require.InDelta(t, 1.0, v, 1e-9)
}

// Namespace aggregate metrics use health_type=namespace and name equal to the namespace string
// (same as the namespace label), matching exportHealthStatusMetrics.
func TestHealthStatusExporter_SetNamespaceAggregateHealth(t *testing.T) {
	cluster := "TestHealthStatusExporter_SetNamespaceAggregateHealth"
	ns := "bookinfo"
	defer deleteTestHealthStatus(t, cluster, ns, internalmetrics.HealthTypeNamespace, ns)

	e := NewHealthStatusExporter(testExporterConfig(true, 3))
	e.Observe(cluster, ns, internalmetrics.HealthTypeNamespace, ns, "Degraded")
	v, found := healthStatusMetricValue(t, cluster, ns, internalmetrics.HealthTypeNamespace, ns)
	require.True(t, found)
	require.InDelta(t, 2.0, v, 1e-9)
}

func TestHealthStatusExporter_NAWithoutPriorSet_NoSeries(t *testing.T) {
	cluster := "TestHealthStatusExporter_NAWithoutPriorSet_NoSeries"
	ns := "ns"
	name := "wk1"
	defer deleteTestHealthStatus(t, cluster, ns, internalmetrics.HealthTypeWorkload, name)

	e := NewHealthStatusExporter(testExporterConfig(true, 2))
	e.Observe(cluster, ns, internalmetrics.HealthTypeWorkload, name, "NA")
	e.Observe(cluster, ns, internalmetrics.HealthTypeWorkload, name, "NA")
	_, found := healthStatusMetricValue(t, cluster, ns, internalmetrics.HealthTypeWorkload, name)
	require.False(t, found)
}

func TestHealthStatusExporter_SetThenNADeletesAfterMaxConsecutiveNA(t *testing.T) {
	cluster := "TestHealthStatusExporter_SetThenNADeletesAfterMaxConsecutiveNA"
	ns := "ns"
	name := "app1"
	defer deleteTestHealthStatus(t, cluster, ns, internalmetrics.HealthTypeApp, name)

	e := NewHealthStatusExporter(testExporterConfig(true, 3))
	e.Observe(cluster, ns, internalmetrics.HealthTypeApp, name, "Degraded")
	v, found := healthStatusMetricValue(t, cluster, ns, internalmetrics.HealthTypeApp, name)
	require.True(t, found)
	require.InDelta(t, 2.0, v, 1e-9)

	e.Observe(cluster, ns, internalmetrics.HealthTypeApp, name, "NA")
	e.Observe(cluster, ns, internalmetrics.HealthTypeApp, name, "NA")
	_, found = healthStatusMetricValue(t, cluster, ns, internalmetrics.HealthTypeApp, name)
	require.True(t, found)

	e.Observe(cluster, ns, internalmetrics.HealthTypeApp, name, "NA")
	_, found = healthStatusMetricValue(t, cluster, ns, internalmetrics.HealthTypeApp, name)
	require.False(t, found)
}

func TestHealthStatusExporter_MaxConsecutiveNAOneDeletesOnFirstNA(t *testing.T) {
	cluster := "TestHealthStatusExporter_MaxConsecutiveNAOneDeletesOnFirstNA"
	ns := "ns"
	name := "app1"
	defer deleteTestHealthStatus(t, cluster, ns, internalmetrics.HealthTypeApp, name)

	e := NewHealthStatusExporter(testExporterConfig(true, 1))
	e.Observe(cluster, ns, internalmetrics.HealthTypeApp, name, "Healthy")
	_, found := healthStatusMetricValue(t, cluster, ns, internalmetrics.HealthTypeApp, name)
	require.True(t, found)

	e.Observe(cluster, ns, internalmetrics.HealthTypeApp, name, "NA")
	_, found = healthStatusMetricValue(t, cluster, ns, internalmetrics.HealthTypeApp, name)
	require.False(t, found)
}

func TestHealthStatusExporter_NAResetsAfterHealthy(t *testing.T) {
	cluster := "TestHealthStatusExporter_NAResetsAfterHealthy"
	ns := "ns"
	name := "app1"
	defer deleteTestHealthStatus(t, cluster, ns, internalmetrics.HealthTypeApp, name)

	e := NewHealthStatusExporter(testExporterConfig(true, 3))
	e.Observe(cluster, ns, internalmetrics.HealthTypeApp, name, "Healthy")
	e.Observe(cluster, ns, internalmetrics.HealthTypeApp, name, "NA")
	e.Observe(cluster, ns, internalmetrics.HealthTypeApp, name, "NA")
	e.Observe(cluster, ns, internalmetrics.HealthTypeApp, name, "Healthy")
	e.Observe(cluster, ns, internalmetrics.HealthTypeApp, name, "NA")
	e.Observe(cluster, ns, internalmetrics.HealthTypeApp, name, "NA")
	_, found := healthStatusMetricValue(t, cluster, ns, internalmetrics.HealthTypeApp, name)
	require.True(t, found)
}

func TestHealthStatusExporter_UnknownStatusTreatedAsNA(t *testing.T) {
	cluster := "TestHealthStatusExporter_UnknownStatusTreatedAsNA"
	ns := "ns"
	name := "app1"
	defer deleteTestHealthStatus(t, cluster, ns, internalmetrics.HealthTypeApp, name)

	e := NewHealthStatusExporter(testExporterConfig(true, 2))
	e.Observe(cluster, ns, internalmetrics.HealthTypeApp, name, "bogus")
	e.Observe(cluster, ns, internalmetrics.HealthTypeApp, name, "bogus")
	_, found := healthStatusMetricValue(t, cluster, ns, internalmetrics.HealthTypeApp, name)
	require.False(t, found)
}

func TestHealthStatusExporter_MaxConsecutiveNAZeroUsesDefaultThree(t *testing.T) {
	cluster := "TestHealthStatusExporter_MaxConsecutiveNAZeroUsesDefaultThree"
	ns := "ns"
	name := "app1"
	defer deleteTestHealthStatus(t, cluster, ns, internalmetrics.HealthTypeApp, name)

	e := NewHealthStatusExporter(testExporterConfig(true, 0))
	e.Observe(cluster, ns, internalmetrics.HealthTypeApp, name, "Failure")
	_, found := healthStatusMetricValue(t, cluster, ns, internalmetrics.HealthTypeApp, name)
	require.True(t, found)

	e.Observe(cluster, ns, internalmetrics.HealthTypeApp, name, "NA")
	e.Observe(cluster, ns, internalmetrics.HealthTypeApp, name, "NA")
	_, found = healthStatusMetricValue(t, cluster, ns, internalmetrics.HealthTypeApp, name)
	require.True(t, found)

	e.Observe(cluster, ns, internalmetrics.HealthTypeApp, name, "NA")
	_, found = healthStatusMetricValue(t, cluster, ns, internalmetrics.HealthTypeApp, name)
	require.False(t, found)
}

func TestHealthStatusExporter_ReconcileMissingIncrementsStreak(t *testing.T) {
	cluster := "TestHealthStatusExporter_ReconcileMissingIncrementsStreak"
	ns := "ns"
	key := NewEntityKey(cluster, ns, internalmetrics.HealthTypeApp, "gone")
	defer deleteTestHealthStatus(t, cluster, ns, internalmetrics.HealthTypeApp, "gone")

	e := NewHealthStatusExporter(testExporterConfig(true, 2))
	e.Observe(cluster, ns, internalmetrics.HealthTypeApp, "gone", "Healthy")
	e.Observe(cluster, ns, internalmetrics.HealthTypeApp, "gone", "NA")
	_, found := healthStatusMetricValue(t, cluster, ns, internalmetrics.HealthTypeApp, "gone")
	require.True(t, found)

	e.ReconcileNamespace(cluster, ns, map[entityKey]bool{})
	_, found = healthStatusMetricValue(t, cluster, ns, internalmetrics.HealthTypeApp, "gone")
	require.False(t, found)

	// Key should not linger in reconcile state
	require.NotContains(t, e.state, key)
}

// Last status was non-NA so state was cleared; entity then disappears from refresh maps.
// Reconcile must still use seriesPresent so the streak advances and the series is removed.
func TestHealthStatusExporter_ReconcileDroppedEntityAfterLastHealthy(t *testing.T) {
	cluster := "TestHealthStatusExporter_ReconcileDroppedEntityAfterLastHealthy"
	ns := "ns"
	name := "removed"
	appKey := NewEntityKey(cluster, ns, internalmetrics.HealthTypeApp, name)
	defer deleteTestHealthStatus(t, cluster, ns, internalmetrics.HealthTypeApp, name)

	e := NewHealthStatusExporter(testExporterConfig(true, 2))
	e.Observe(cluster, ns, internalmetrics.HealthTypeApp, name, "Healthy")
	_, found := healthStatusMetricValue(t, cluster, ns, internalmetrics.HealthTypeApp, name)
	require.True(t, found)
	require.NotContains(t, e.state, appKey)

	nsKey := NewEntityKey(cluster, ns, internalmetrics.HealthTypeNamespace, ns)
	seenKeys := map[entityKey]bool{nsKey: true}

	e.ReconcileNamespace(cluster, ns, seenKeys)
	require.Contains(t, e.state, appKey)
	require.Equal(t, 1, e.state[appKey].naStreak)
	_, found = healthStatusMetricValue(t, cluster, ns, internalmetrics.HealthTypeApp, name)
	require.True(t, found)

	e.ReconcileNamespace(cluster, ns, seenKeys)
	require.NotContains(t, e.state, appKey)
	_, found = healthStatusMetricValue(t, cluster, ns, internalmetrics.HealthTypeApp, name)
	require.False(t, found)
}

func TestHealthStatusExporter_ReconcileDroppedEntityLimitOneDeletesImmediately(t *testing.T) {
	cluster := "TestHealthStatusExporter_ReconcileDroppedEntityLimitOneDeletesImmediately"
	ns := "ns"
	name := "removed"
	defer deleteTestHealthStatus(t, cluster, ns, internalmetrics.HealthTypeApp, name)

	e := NewHealthStatusExporter(testExporterConfig(true, 1))
	e.Observe(cluster, ns, internalmetrics.HealthTypeApp, name, "Healthy")
	nsKey := NewEntityKey(cluster, ns, internalmetrics.HealthTypeNamespace, ns)
	e.ReconcileNamespace(cluster, ns, map[entityKey]bool{nsKey: true})
	_, found := healthStatusMetricValue(t, cluster, ns, internalmetrics.HealthTypeApp, name)
	require.False(t, found)
}

func TestHealthStatusExporter_ReconcileSeenKeyDoesNotAdvanceStreak(t *testing.T) {
	cluster := "TestHealthStatusExporter_ReconcileSeenKeyDoesNotAdvanceStreak"
	ns := "ns"
	name := "app1"
	key := NewEntityKey(cluster, ns, internalmetrics.HealthTypeApp, name)
	defer deleteTestHealthStatus(t, cluster, ns, internalmetrics.HealthTypeApp, name)

	e := NewHealthStatusExporter(testExporterConfig(true, 2))
	e.Observe(cluster, ns, internalmetrics.HealthTypeApp, name, "Healthy")
	e.Observe(cluster, ns, internalmetrics.HealthTypeApp, name, "NA")
	_, found := healthStatusMetricValue(t, cluster, ns, internalmetrics.HealthTypeApp, name)
	require.True(t, found)

	e.ReconcileNamespace(cluster, ns, map[entityKey]bool{key: true})
	_, found = healthStatusMetricValue(t, cluster, ns, internalmetrics.HealthTypeApp, name)
	require.True(t, found)
	require.Contains(t, e.state, key)
	require.Equal(t, 1, e.state[key].naStreak)
}

// Namespace "gone" is no longer in the API list for this cluster; "kept" still is.
func TestHealthStatusExporter_ReconcileDroppedNamespacesForCluster(t *testing.T) {
	cluster := "TestHealthStatusExporter_ReconcileDroppedNamespacesForCluster"
	nsGone := "gone"
	nsKept := "kept"
	name := "app1"
	defer deleteTestHealthStatus(t, cluster, nsGone, internalmetrics.HealthTypeApp, name)
	defer deleteTestHealthStatus(t, cluster, nsKept, internalmetrics.HealthTypeApp, name)

	e := NewHealthStatusExporter(testExporterConfig(true, 1))
	e.Observe(cluster, nsGone, internalmetrics.HealthTypeApp, name, "Healthy")
	e.Observe(cluster, nsKept, internalmetrics.HealthTypeApp, name, "Healthy")
	_, foundGone := healthStatusMetricValue(t, cluster, nsGone, internalmetrics.HealthTypeApp, name)
	_, foundKept := healthStatusMetricValue(t, cluster, nsKept, internalmetrics.HealthTypeApp, name)
	require.True(t, foundGone)
	require.True(t, foundKept)

	e.ReconcileDroppedNamespacesForCluster(cluster, map[string]bool{nsKept: true})
	_, foundGone = healthStatusMetricValue(t, cluster, nsGone, internalmetrics.HealthTypeApp, name)
	_, foundKept = healthStatusMetricValue(t, cluster, nsKept, internalmetrics.HealthTypeApp, name)
	require.False(t, foundGone)
	require.True(t, foundKept)
}

// Cluster c2 disappeared from cache; metrics should be reconciled toward removal.
func TestHealthStatusExporter_ReconcileDroppedClusters(t *testing.T) {
	c1 := "TestHealthStatusExporter_ReconcileDroppedClusters_c1"
	c2 := "TestHealthStatusExporter_ReconcileDroppedClusters_c2"
	ns := "ns"
	name := "app1"
	defer deleteTestHealthStatus(t, c1, ns, internalmetrics.HealthTypeApp, name)
	defer deleteTestHealthStatus(t, c2, ns, internalmetrics.HealthTypeApp, name)

	e := NewHealthStatusExporter(testExporterConfig(true, 1))
	e.Observe(c1, ns, internalmetrics.HealthTypeApp, name, "Healthy")
	e.Observe(c2, ns, internalmetrics.HealthTypeApp, name, "Healthy")

	e.ReconcileDroppedClusters(map[string]bool{c1: true})
	_, foundC1 := healthStatusMetricValue(t, c1, ns, internalmetrics.HealthTypeApp, name)
	_, foundC2 := healthStatusMetricValue(t, c2, ns, internalmetrics.HealthTypeApp, name)
	require.True(t, foundC1)
	require.False(t, foundC2)
}
