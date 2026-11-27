package mcputil

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
)

func TestMetricsTimeWindow(t *testing.T) {
	now := time.Date(2026, time.March, 10, 12, 0, 0, 0, time.UTC)
	to := time.Date(2026, time.March, 9, 8, 0, 0, 0, time.UTC)

	cases := map[string]struct {
		args      map[string]interface{}
		wantStart time.Time
		wantEnd   time.Time
		wantErr   string
	}{
		"defaults to the last 30 minutes": {
			args:      map[string]interface{}{},
			wantStart: now.Add(-30 * time.Minute),
			wantEnd:   now,
		},
		"since as a duration before now": {
			args:      map[string]interface{}{"since": "2h"},
			wantStart: now.Add(-2 * time.Hour),
			wantEnd:   now,
		},
		"since in days": {
			args:      map[string]interface{}{"since": "1d"},
			wantStart: now.Add(-24 * time.Hour),
			wantEnd:   now,
		},
		"since as a duration before to": {
			args:      map[string]interface{}{"since": "15m", "to": "2026-03-09T08:00:00Z"},
			wantStart: to.Add(-15 * time.Minute),
			wantEnd:   to,
		},
		"since and to as timestamps": {
			args:      map[string]interface{}{"since": "2026-03-09T06:30:00Z", "to": "2026-03-09T08:00:00Z"},
			wantStart: time.Date(2026, time.March, 9, 6, 30, 0, 0, time.UTC),
			wantEnd:   to,
		},
		"to alone keeps the default duration": {
			args:      map[string]interface{}{"to": "2026-03-09T08:00:00Z"},
			wantStart: to.Add(-30 * time.Minute),
			wantEnd:   to,
		},
		"to with a time zone offset": {
			args:      map[string]interface{}{"since": "1h", "to": "2026-03-09T10:00:00+02:00"},
			wantStart: to.Add(-time.Hour),
			wantEnd:   to,
		},
		"since overrides duration": {
			args:      map[string]interface{}{"since": "5m", "duration": "3600"},
			wantStart: now.Add(-5 * time.Minute),
			wantEnd:   now,
		},
		"to overrides queryTime": {
			args:      map[string]interface{}{"to": "2026-03-09T08:00:00Z", "queryTime": "1"},
			wantStart: to.Add(-30 * time.Minute),
			wantEnd:   to,
		},
		"legacy duration and queryTime still work": {
			args:      map[string]interface{}{"duration": "600", "queryTime": "1773043200"},
			wantStart: time.Unix(1773043200, 0).Add(-10 * time.Minute),
			wantEnd:   time.Unix(1773043200, 0),
		},
		"invalid to": {
			args:    map[string]interface{}{"to": "yesterday"},
			wantErr: "'to' must be an RFC3339 timestamp",
		},
		"invalid since": {
			args:    map[string]interface{}{"since": "a while ago"},
			wantErr: "'since' must be an RFC3339 timestamp or a duration",
		},
		"zero since": {
			args:    map[string]interface{}{"since": "0s"},
			wantErr: "'since' must be an RFC3339 timestamp or a duration",
		},
		"since after to": {
			args:    map[string]interface{}{"since": "2026-03-09T09:00:00Z", "to": "2026-03-09T08:00:00Z"},
			wantErr: "'since' must be before 'to'",
		},
		"since equal to to": {
			args:    map[string]interface{}{"since": "2026-03-09T08:00:00Z", "to": "2026-03-09T08:00:00Z"},
			wantErr: "'since' must be before 'to'",
		},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			start, end, err := metricsTimeWindow(tc.args, now)
			if tc.wantErr != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tc.wantErr)
				return
			}
			require.NoError(t, err)
			assert.True(t, tc.wantStart.Equal(start), "start: want %s, got %s", tc.wantStart, start)
			assert.True(t, tc.wantEnd.Equal(end), "end: want %s, got %s", tc.wantEnd, end)
		})
	}
}

func TestExtractBaseMetricsQueryParamsTimeRange(t *testing.T) {
	ns := &models.Namespace{CreationTimestamp: time.Date(2020, time.January, 1, 0, 0, 0, 0, time.UTC)}

	t.Run("uses since and to", func(t *testing.T) {
		q := prometheus.RangeQuery{}
		err := extractBaseMetricsQueryParams(map[string]interface{}{
			"since": "2026-03-09T07:00:00Z",
			"to":    "2026-03-09T08:00:00Z",
		}, &q, ns)
		require.NoError(t, err)
		assert.Equal(t, time.Date(2026, time.March, 9, 7, 0, 0, 0, time.UTC), q.Start.UTC())
		assert.Equal(t, time.Date(2026, time.March, 9, 8, 0, 0, 0, time.UTC), q.End.UTC())
		assert.Equal(t, 15*time.Second, q.Step)
	})

	t.Run("widens the default step for a long range", func(t *testing.T) {
		q := prometheus.RangeQuery{}
		err := extractBaseMetricsQueryParams(map[string]interface{}{
			"since": "7d",
			"to":    "2026-03-09T08:00:00Z",
		}, &q, ns)
		require.NoError(t, err)
		assert.Greater(t, q.Step, 15*time.Second)
		assert.LessOrEqual(t, int(q.End.Sub(q.Start)/q.Step), maxPointsPerSeries)
	})

	t.Run("keeps a step the caller set", func(t *testing.T) {
		q := prometheus.RangeQuery{}
		err := extractBaseMetricsQueryParams(map[string]interface{}{
			"since": "7d",
			"to":    "2026-03-09T08:00:00Z",
			"step":  "30",
		}, &q, ns)
		require.NoError(t, err)
		assert.Equal(t, 30*time.Second, q.Step)
	})

	t.Run("returns an error for since after to", func(t *testing.T) {
		q := prometheus.RangeQuery{}
		err := extractBaseMetricsQueryParams(map[string]interface{}{
			"since": "2026-03-09T09:00:00Z",
			"to":    "2026-03-09T08:00:00Z",
		}, &q, ns)
		require.Error(t, err)
	})
}
