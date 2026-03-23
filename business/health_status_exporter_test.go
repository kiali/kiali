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
