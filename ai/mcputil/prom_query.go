package mcputil

import (
	"context"
	"errors"
	"fmt"
	"time"

	prom_v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/kiali/kiali/prometheus"
)

// ErrNoData indicates the query succeeded but returned no samples.
var ErrNoData = errors.New("no data")

// PromQuery executes an instant Prometheus query.
// It is intended for AI MCP tools that need ad-hoc queries.
func PromQuery(ctx context.Context, prom prometheus.ClientInterface, query string, ts time.Time) (model.Value, prom_v1.Warnings, error) {
	if prom == nil || prom.API() == nil {
		return nil, nil, k8serrors.NewServiceUnavailable("prometheus client not available")
	}

	result, warnings, err := prom.API().Query(ctx, query, ts)
	if err != nil {
		return nil, warnings, k8serrors.NewServiceUnavailable(err.Error())
	}
	return result, warnings, nil
}

// PromQueryFloat64 executes a Prometheus query and returns a single numeric value.
// If the response is a vector with multiple samples, values are summed.
func PromQueryFloat64(ctx context.Context, prom prometheus.ClientInterface, query string, ts time.Time) (float64, error) {
	v, warnings, err := PromQuery(ctx, prom, query, ts)
	_ = warnings // best-effort
	if err != nil {
		return 0, err
	}

	switch t := v.(type) {
	case model.Vector:
		if len(t) == 0 {
			return 0, ErrNoData
		}
		sum := 0.0
		for _, s := range t {
			sum += float64(s.Value)
		}
		return sum, nil
	case *model.Scalar:
		return float64(t.Value), nil
	default:
		return 0, fmt.Errorf("unexpected prometheus result type %T", v)
	}
}

// PromQueryVectorByLabel executes a Prometheus query and returns a map[labelValue]float64.
func PromQueryVectorByLabel(ctx context.Context, prom prometheus.ClientInterface, query string, ts time.Time, label string) (map[string]float64, error) {
	v, warnings, err := PromQuery(ctx, prom, query, ts)
	_ = warnings // best-effort
	if err != nil {
		return nil, err
	}

	switch t := v.(type) {
	case model.Vector:
		if len(t) == 0 {
			return map[string]float64{}, ErrNoData
		}
		out := map[string]float64{}
		for _, sample := range t {
			key := string(sample.Metric[model.LabelName(label)])
			out[key] = float64(sample.Value)
		}
		return out, nil
	case *model.Scalar:
		return map[string]float64{"": float64(t.Value)}, nil
	default:
		return nil, fmt.Errorf("unexpected prometheus result type %T", v)
	}
}
