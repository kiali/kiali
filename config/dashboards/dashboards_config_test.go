package dashboards

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAddMonitoringDashboards(t *testing.T) {
	builtInListSize := 21

	list := GetBuiltInMonitoringDashboards()
	assert.Equal(t, builtInListSize, len(list))

	additional := MonitoringDashboardsList{
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
	assert.Equal(t, builtInListSize+2, len(list))

	listMap := list.OrganizeByName()
	assert.Equal(t, "Foo", listMap["foo"].Title)
	assert.Equal(t, "Bar", listMap["bar"].Title)

	// add dashboard with a name that already exists, but test that it overwrites the original
	additional = MonitoringDashboardsList{
		MonitoringDashboard{
			Name:       "foo",
			Title:      "NewFoo",
			DiscoverOn: "foo",
		},
	}
	list = AddMonitoringDashboards(list, additional)
	assert.Equal(t, builtInListSize+2, len(list))

	listMap = list.OrganizeByName()
	assert.Equal(t, "NewFoo", listMap["foo"].Title)

	// add dashboard definition that effectively disables (removes) the existing dashboard.
	// You can turn off or disable built-in dashboards this way.
	additional = MonitoringDashboardsList{
		MonitoringDashboard{
			Name:       "foo",
			DiscoverOn: "",
		},
	}
	list = AddMonitoringDashboards(list, additional)
	assert.Equal(t, builtInListSize+1, len(list))

	listMap = list.OrganizeByName()
	_, exists := listMap["foo"]
	assert.False(t, exists)
}

func TestGetBuiltInMonitoringDashboards(t *testing.T) {
	builtInListSize := 21

	list := GetBuiltInMonitoringDashboards()
	assert.Equal(t, builtInListSize, len(list))

	listMap := list.OrganizeByName()

	// see that one of the dashboards was unmarshalled successfully
	d := listMap["go"]
	assert.Equal(t, "go", d.Name)
	assert.Equal(t, "Go Metrics", d.Title)
	assert.Equal(t, "Go", d.Runtime)
	assert.Equal(t, "go_info", d.DiscoverOn)
	assert.Equal(t, 6, len(d.Items))
	assert.Equal(t, "CPU ratio", d.Items[0].Chart.Name)
	assert.Equal(t, 4, d.Items[0].Chart.Spans)
	assert.Equal(t, "container_cpu_usage_seconds_total", d.Items[0].Chart.MetricName)
	assert.Equal(t, Rate, d.Items[0].Chart.DataType)
}

func TestDeepCopy(t *testing.T) {
	list := GetBuiltInMonitoringDashboards()
	dup := list.DeepCopy()
	assert.Same(t, &list, &list)
	assert.Same(t, &dup, &dup)
	assert.Same(t, &(list[0].Items), &(list[0].Items))
	assert.NotSame(t, &list, &dup)
	assert.NotSame(t, &(list[0].Items), &((*dup)[0].Items))

	// just make sure some of the copied data is the same
	assert.Equal(t, list[0].Name, (*dup)[0].Name)
	assert.Equal(t, list[0].Title, (*dup)[0].Title)
	assert.Equal(t, len(list[0].Items), len((*dup)[0].Items))
	assert.Equal(t, list[0].Items[0].Chart.Name, (*dup)[0].Items[0].Chart.Name)
}
