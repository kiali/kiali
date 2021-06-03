package dashboards

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAddMonitoringDashboards(t *testing.T) {
	builtInListSize := 20

	list := GetBuiltInMonitoringDashboards()
	assert.Equal(t, builtInListSize, len(*list))

	additional := &MonitoringDashboardsList{
		MonitoringDashboard{
			Name:       "foo",
			Title:      "Foo",
			DiscoverOn: "foo",
		},
		{
			Name:       "bar",
			Title:      "Bar",
			DiscoverOn: "foo",
		},
	}
	list = AddMonitoringDashboards(list, additional)
	assert.Equal(t, builtInListSize+2, len(*list))

	listMap := list.organizeByName()
	assert.Equal(t, "Foo", listMap["foo"].Title)
	assert.Equal(t, "Bar", listMap["bar"].Title)

	// add dashboard with a name that already exists, but test that it overwrites the original
	additional = &MonitoringDashboardsList{
		MonitoringDashboard{
			Name:       "foo",
			Title:      "NewFoo",
			DiscoverOn: "foo",
		},
	}
	list = AddMonitoringDashboards(list, additional)
	assert.Equal(t, builtInListSize+2, len(*list))

	listMap = list.organizeByName()
	assert.Equal(t, "NewFoo", listMap["foo"].Title)

	// add dashboard definition that effectively disables (removes) the existing dashboard.
	// You can turn off or disable built-in dashboards this way.
	additional = &MonitoringDashboardsList{
		MonitoringDashboard{
			Name:       "foo",
			DiscoverOn: "",
		},
	}
	list = AddMonitoringDashboards(list, additional)
	assert.Equal(t, builtInListSize+1, len(*list))

	listMap = list.organizeByName()
	_, exists := listMap["foo"]
	assert.False(t, exists)
}

func TestGetBuiltInMonitoringDashboards(t *testing.T) {
	builtInListSize := 20

	list := GetBuiltInMonitoringDashboards()
	assert.Equal(t, builtInListSize, len(*list))

	listMap := list.organizeByName()

	// see that one of the dashboards was unmarshalled successfully
	d := listMap["go"]
	assert.Equal(t, "go", d.Name)
	assert.Equal(t, "Go Metrics", d.Title)
	assert.Equal(t, "Go", d.Runtime)
	assert.Equal(t, "go_info", d.DiscoverOn)
	assert.Equal(t, 6, len(d.Items))
	assert.Equal(t, "CPU ratio", d.Items[0].Chart.Name)
	assert.Equal(t, 6, d.Items[0].Chart.Spans)
	assert.Equal(t, "process_cpu_seconds_total", d.Items[0].Chart.MetricName)
	assert.Equal(t, Rate, d.Items[0].Chart.DataType)
}

func TestDeepCopy(t *testing.T) {
	list := GetBuiltInMonitoringDashboards()
	dup := list.DeepCopy()
	assert.Same(t, list, list)
	assert.Same(t, dup, dup)
	assert.NotSame(t, list, dup)
}
