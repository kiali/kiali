package prometheus

import (
	"context"
	"runtime"
	"strings"
	"time"

	prom_v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"

	"github.com/kiali/kiali/log"
)

// PromQueryTraceAPI wraps prom_v1.API and logs instant and range PromQL at trace
// level using the request context logger. The log message is the name of the direct
// caller (e.g. fetchQuery, getRequestRatesForLabel) so operators can see which
// code path issued the query.
type PromQueryTraceAPI struct {
	prom_v1.API
}

// NewPromQueryTraceAPI returns a prom_v1.API that trace-logs Query and QueryRange calls.
func NewPromQueryTraceAPI(api prom_v1.API) prom_v1.API {
	return &PromQueryTraceAPI{API: api}
}

func (p *PromQueryTraceAPI) Query(ctx context.Context, query string, ts time.Time, opts ...prom_v1.Option) (model.Value, prom_v1.Warnings, error) {
	tracePromQuery(ctx, promQueryTraceCaller(), query)
	return p.API.Query(ctx, query, ts, opts...)
}

func (p *PromQueryTraceAPI) QueryRange(ctx context.Context, query string, r prom_v1.Range, opts ...prom_v1.Option) (model.Value, prom_v1.Warnings, error) {
	tracePromQuery(ctx, promQueryTraceCaller(), query)
	return p.API.QueryRange(ctx, query, r, opts...)
}

func tracePromQuery(ctx context.Context, caller, query string) {
	log.FromContext(ctx).Trace().Str("query", query).Msg(caller)
}

func promQueryTraceCaller() string {
	const skip = 2 // immediate caller of PromQueryTraceAPI.Query / QueryRange
	pc, _, _, ok := runtime.Caller(skip)
	if !ok {
		return "PrometheusQuery"
	}
	fn := runtime.FuncForPC(pc)
	if fn == nil {
		return "PrometheusQuery"
	}
	name := fn.Name()
	if i := strings.LastIndex(name, "."); i >= 0 {
		name = name[i+1:]
	}
	// Strip closure suffix so "GetDashboard.func1" becomes "GetDashboard".
	if i := strings.Index(name, "."); i >= 0 {
		name = name[:i]
	}
	return name
}
