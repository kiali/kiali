package kubernetes

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestTimeDurationUnmarshalJSONObject(t *testing.T) {
	var duration TimeDuration

	err := json.Unmarshal([]byte(`{"secs":5,"nanos":12}`), &duration)

	require.NoError(t, err)
	require.Equal(t, TimeDuration{Secs: 5, Nanos: 12}, duration)
}

func TestTimeDurationUnmarshalJSONNumberAsSeconds(t *testing.T) {
	var duration TimeDuration

	err := json.Unmarshal([]byte(`5`), &duration)

	require.NoError(t, err)
	require.Equal(t, TimeDuration{Secs: 5}, duration)
}

func TestDNSResolverOptionsUnmarshalMixedVersionFields(t *testing.T) {
	var opts DNSResolverOptions

	err := json.Unmarshal([]byte(`{"timeout":5,"use_hosts_file":true}`), &opts)

	require.NoError(t, err)
	require.Equal(t, TimeDuration{Secs: 5}, opts.Timeout)
	require.Equal(t, BoolOrString("true"), opts.UseHostsFile)
}
