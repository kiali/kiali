package queryparams

import (
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/util"
)

func TestParseWithConfigRejectsUnknown(t *testing.T) {
	conf := config.NewConfig()
	query := url.Values{}
	query.Set("health", "true")
	query.Set("foo", "bar")

	_, err := ParseWithConfig(query, conf, []Param{BoolParam("health", true)})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported query parameter 'foo'")
}

func TestParseWithConfigParsesDeclaredParams(t *testing.T) {
	conf := config.NewConfig()
	util.Clock = util.ClockMock{Time: time.Unix(1700000000, 0)}
	defer func() { util.Clock = util.RealClock{} }()

	query := url.Values{}
	query.Set("health", "false")
	query.Set("rateInterval", "10m")
	query.Set("clusterName", "east")
	query.Set("type", "app")

	result, err := ParseWithConfig(query, conf, []Param{
		ClusterParam(),
		BoolParam("health", true),
		PromDurationParam("rateInterval", "5m"),
		TimestampParam("queryTime"),
		EnumParam("type", "app", "service", "workload"),
	})
	require.NoError(t, err)
	assert.Equal(t, "east", result.Cluster())
	assert.False(t, result.Bool("health"))
	assert.Equal(t, "10m", result.Duration("rateInterval"))
	assert.Equal(t, time.Unix(1700000000, 0), result.Time("queryTime"))
	assert.Equal(t, "app", result.String("type"))
}

func TestParseWithConfigInvalidValues(t *testing.T) {
	conf := config.NewConfig()

	t.Run("invalid bool", func(t *testing.T) {
		query := url.Values{"health": []string{"maybe"}}
		_, err := ParseWithConfig(query, conf, []Param{BoolParam("health", true)})
		require.Error(t, err)
	})

	t.Run("invalid duration", func(t *testing.T) {
		query := url.Values{"rateInterval": []string{"invalid"}}
		_, err := ParseWithConfig(query, conf, []Param{PromDurationParam("rateInterval", "5m")})
		require.Error(t, err)
	})

	t.Run("invalid enum", func(t *testing.T) {
		query := url.Values{"type": []string{"pod"}}
		_, err := ParseWithConfig(query, conf, []Param{EnumParam("type", "app", "service")})
		require.Error(t, err)
	})
}
