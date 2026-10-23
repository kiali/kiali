package models

import (
	"encoding/json"
	"reflect"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWorkloadDoesNotShadowListItemFields(t *testing.T) {
	listType := reflect.TypeFor[WorkloadListItem]()
	workloadType := reflect.TypeFor[Workload]()
	for i := 0; i < listType.NumField(); i++ {
		name := listType.Field(i).Name
		field, found := workloadType.FieldByName(name)
		require.True(t, found, "missing promoted field %s", name)
		assert.Greater(t, len(field.Index), 1, "Workload redeclares %s", name)
		_, methodFound := reflect.PointerTo(workloadType).MethodByName(name)
		assert.False(t, methodFound, "Workload method shadows %s", name)
	}
}

func TestWorkloadSharedFieldsJSON(t *testing.T) {
	w := Workload{
		WorkloadListItem: WorkloadListItem{
			Health:     WorkloadHealth{Status: &CalculatedHealthStatus{Status: HealthStatusFailure}},
			IsGateway:  true,
			IsWaypoint: true,
			IsZtunnel:  true,
			SpireInfo:  &SpireInfo{IsSpireManaged: true},
		},
	}
	data, err := json.Marshal(w)
	require.NoError(t, err)
	var result map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(data, &result))
	assert.JSONEq(t, `{"requests":{"healthAnnotations":null,"inbound":null,"outbound":null},"status":{"status":"Failure"},"workloadStatus":null}`, string(result["health"]))
	assert.JSONEq(t, `{"isSpireManaged":true,"isSpireServer":false}`, string(result["spireInfo"]))
	for _, key := range []string{"isGateway", "isWaypoint", "isZtunnel"} {
		assert.JSONEq(t, "true", string(result[key]))
	}
	var decoded Workload
	require.NoError(t, json.Unmarshal(data, &decoded))
	listItem := &decoded.WorkloadListItem
	assert.Equal(t, w.Health, listItem.Health)
	assert.Equal(t, w.SpireInfo, listItem.SpireInfo)
	require.Same(t, decoded.SpireInfo, listItem.SpireInfo)
	decoded.SpireInfo.IsSpireManaged = false
	assert.False(t, listItem.SpireInfo.IsSpireManaged)

	emptyData, err := json.Marshal(Workload{})
	require.NoError(t, err)
	var emptyResult map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(emptyData, &emptyResult))
	assert.Contains(t, emptyResult, "health")
	assert.NotContains(t, emptyResult, "spireInfo")
}

func TestWorkloadHasHTTPTrafficUsesWorkloadMetadata(t *testing.T) {
	cases := []struct {
		name     string
		want     bool
		workload Workload
	}{
		{name: "plain workload"},
		{name: "sidecar", want: true, workload: Workload{WorkloadListItem: WorkloadListItem{IstioSidecar: true}}},
		{name: "gateway with unset list flag", want: true, workload: Workload{WorkloadListItem: WorkloadListItem{Labels: map[string]string{"istio": "ingressgateway"}}}},
		{name: "stale gateway list flag", workload: Workload{WorkloadListItem: WorkloadListItem{IsGateway: true}}},
		{name: "ambient workload with waypoint", want: true, workload: Workload{WaypointWorkloads: []WorkloadReferenceInfo{{Name: "waypoint"}}}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, tc.workload.HasHTTPTraffic())
		})
	}
}
