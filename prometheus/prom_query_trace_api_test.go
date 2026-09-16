package prometheus

import (
	"bytes"
	"context"
	"testing"
	"time"

	prom_v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/log"
)

func promQueryTraceCallerProbe(ctx context.Context, api prom_v1.API) {
	_, _, _ = api.Query(ctx, "up", time.Now())
}

func TestPromQueryTraceAPILogsDirectCaller(t *testing.T) {
	var buf bytes.Buffer
	zl := zerolog.New(&buf)
	ctx := log.ToContext(context.Background(), &zl)

	api := NewPromQueryTraceAPI(&noopAPI{})
	promQueryTraceCallerProbe(ctx, api)

	logged := buf.String()
	assert.Contains(t, logged, "promQueryTraceCallerProbe")
	assert.Contains(t, logged, "up")
}
