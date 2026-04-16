package get_metrics

import (
	"math"
	"sort"
	"strings"
	"time"

	"github.com/kiali/kiali/models"
)

// LLMMetricsSummary is a token-efficient JSON view of Istio metrics for LLM consumption.
type LLMMetricsSummary struct {
	Context    SummaryContext         `json:"context"`
	Empty      bool                   `json:"empty"`
	Errors     *ErrorsSummary         `json:"errors,omitempty"`
	GrpcTcp    map[string]SeriesStats `json:"grpcTcp,omitempty"`
	Latency    *LatencySummary        `json:"latency,omitempty"`
	Message    string                 `json:"message,omitempty"`
	Overview   *Overview              `json:"overview,omitempty"`
	Sizes      []SizeMetricBlock      `json:"sizes,omitempty"`
	Snapshot   *Snapshot              `json:"snapshot,omitempty"`
	Traffic    *TrafficSummary        `json:"traffic,omitempty"`
	Throughput []ThroughputBlock      `json:"throughput,omitempty"`
}

// SummaryContext identifies the query scope and time window.
type SummaryContext struct {
	Cluster        string `json:"cluster,omitempty"`
	Direction      string `json:"direction"`
	Namespace      string `json:"namespace"`
	RateInterval   string `json:"rateInterval"`
	Reporter       string `json:"reporter"`
	ResourceName   string `json:"resourceName"`
	ResourceType   string `json:"resourceType"`
	WindowDuration string `json:"windowDuration,omitempty"`
	WindowEnd      string `json:"windowEnd,omitempty"`
	WindowStart    string `json:"windowStart,omitempty"`
}

// Snapshot is a short executive summary of the window.
type Snapshot struct {
	Direction        string   `json:"direction,omitempty"`
	Reporter         string   `json:"reporter,omitempty"`
	LatencyP99Avg    *float64 `json:"latencyP99AvgMs,omitempty"`
	LatencyP99Max    *float64 `json:"latencyP99MaxMs,omitempty"`
	LatencyP99Min    *float64 `json:"latencyP99MinMs,omitempty"`
	LatencyP99StdDev *float64 `json:"latencyP99StdDevMs,omitempty"`
	RequestRateAvg   *float64 `json:"requestRateAvgPerS,omitempty"`
	RequestRateMax   *float64 `json:"requestRateMaxPerS,omitempty"`
	RequestRateMin   *float64 `json:"requestRateMinPerS,omitempty"`
}

// Overview highlights key signals in one place.
type Overview struct {
	Latency     *OverviewLatency `json:"latency,omitempty"`
	RequestRate *OverviewRate    `json:"requestRate,omitempty"`
}

// OverviewLatency uses the avg duration series plus P95/P99 quantile series means.
type OverviewLatency struct {
	AvgMs      float64  `json:"avgMs"`
	FlatSeries bool     `json:"flatSeries"`
	P95Ms      *float64 `json:"p95Ms,omitempty"`
	P99Ms      *float64 `json:"p99Ms,omitempty"`
	StdDevMs   float64  `json:"stdDevMs"`
}

// OverviewRate summarizes request_count over the window.
type OverviewRate struct {
	AvgPerS float64 `json:"avgPerS"`
	Stable  bool    `json:"stable"`
}

// LatencySummary aggregates request_duration_millis quantile series.
type LatencySummary struct {
	Quantiles []QuantileStats `json:"quantiles"`
	Trend     *TrendSummary   `json:"trend,omitempty"`
}

// QuantileStats is window min/max/mean/stddev for one histogram stat (e.g. P99).
type QuantileStats struct {
	Avg    float64 `json:"avg"`
	Label  string  `json:"label"`
	Max    float64 `json:"max"`
	Min    float64 `json:"min"`
	Stat   string  `json:"stat"`
	StdDev float64 `json:"stdDev"`
}

// TrafficSummary covers request_count.
type TrafficSummary struct {
	SeriesStats
	Stable bool          `json:"stable"`
	Trend  *TrendSummary `json:"trend,omitempty"`
}

// ThroughputBlock is request or response byte rate.
type ThroughputBlock struct {
	Name   string        `json:"name"`
	Stable bool          `json:"stable"`
	Stats  SeriesStats   `json:"stats"`
	Trend  *TrendSummary `json:"trend,omitempty"`
	Title  string        `json:"title"`
}

// SizeMetricBlock groups stats for request_size or response_size.
type SizeMetricBlock struct {
	Metric string        `json:"metric"`
	Stats  []SizeStatRow `json:"stats"`
	Title  string        `json:"title"`
}

// SizeStatRow is one quantile/avg row for byte histograms.
type SizeStatRow struct {
	Constant bool          `json:"constant"`
	Label    string        `json:"label"`
	Stats    SeriesStats   `json:"stats"`
	Trend    *TrendSummary `json:"trend,omitempty"`
}

// ErrorsSummary summarizes request_error_count.
type ErrorsSummary struct {
	EmptySeries bool    `json:"emptySeries"`
	Max         float64 `json:"max,omitempty"`
	Min         float64 `json:"min,omitempty"`
	Total       float64 `json:"total,omitempty"`
	ZeroErrors  bool    `json:"zeroErrors"`
}

// SeriesStats is min/max/mean/stddev over a time series in the window.
type SeriesStats struct {
	Avg    float64 `json:"avg"`
	Max    float64 `json:"max"`
	Min    float64 `json:"min"`
	StdDev float64 `json:"stdDev"`
}

// TrendSummary buckets the timeline and describes change vs start/end.
type TrendSummary struct {
	BucketAverages []float64 `json:"bucketAverages"`
	BucketCount    int       `json:"bucketCount"`
	EndValue       float64   `json:"endValue"`
	MaxBucketIndex int       `json:"maxBucketIndex"`
	MaxValue       float64   `json:"maxValue"`
	Pattern        string    `json:"pattern"`
	StartValue     float64   `json:"startValue"`
	Title          string    `json:"title"`
	Unit           string    `json:"unit"`
}

const (
	trendBuckets       = 4
	stableRangeToMean  = 0.02
	stableAbsTolerance = 1e-9
)

// SummarizeMetricsForLLM compresses a raw MetricsMap into structured JSON fields.
func SummarizeMetricsForLLM(
	m models.MetricsMap,
	resourceType, namespace, resourceName string,
	query *models.IstioMetricsQuery,
) LLMMetricsSummary {
	ctx := buildSummaryContext(resourceType, namespace, resourceName, query)
	if len(m) == 0 {
		return LLMMetricsSummary{
			Context: ctx,
			Empty:   true,
			Message: "No metrics returned for the selected window.",
		}
	}
	out := LLMMetricsSummary{
		Context:    ctx,
		Snapshot:   buildSnapshot(m, query),
		Overview:   buildOverview(m),
		Latency:    buildLatencySummary(m),
		Traffic:    buildTrafficSummary(m),
		Throughput: buildThroughputBlocks(m),
		Sizes:      buildSizeBlocks(m),
		Errors:     buildErrorsSummary(m),
		GrpcTcp:    buildGrpcTcpStats(m),
	}
	return out
}

func buildSummaryContext(resourceType, namespace, resourceName string, q *models.IstioMetricsQuery) SummaryContext {
	c := SummaryContext{
		Direction:    "outbound",
		Namespace:    namespace,
		RateInterval: "default",
		Reporter:     "source",
		ResourceName: resourceName,
		ResourceType: resourceType,
	}
	if q == nil {
		return c
	}
	if q.Cluster != "" {
		c.Cluster = q.Cluster
	}
	if q.Direction != "" {
		c.Direction = q.Direction
	}
	if q.RateInterval != "" {
		c.RateInterval = q.RateInterval
	}
	if q.Reporter != "" {
		c.Reporter = q.Reporter
	}
	if !q.Start.IsZero() {
		c.WindowStart = q.Start.UTC().Format(time.RFC3339)
	}
	if !q.End.IsZero() {
		c.WindowEnd = q.End.UTC().Format(time.RFC3339)
	}
	if !q.Start.IsZero() && !q.End.IsZero() {
		c.WindowDuration = q.End.Sub(q.Start).Round(time.Second).String()
	}
	return c
}

func buildSnapshot(m models.MetricsMap, q *models.IstioMetricsQuery) *Snapshot {
	s := &Snapshot{}
	if q != nil {
		if q.Direction != "" {
			s.Direction = q.Direction
		}
		if q.Reporter != "" {
			s.Reporter = q.Reporter
		}
	}
	if p99 := pickMetricStat(m["request_duration_millis"], "0.99"); p99 != nil && len(p99.Datapoints) > 0 {
		st := aggregateSeries(p99.Datapoints)
		s.LatencyP99Min = &st.min
		s.LatencyP99Max = &st.max
		s.LatencyP99Avg = &st.mean
		s.LatencyP99StdDev = &st.stdDev
	}
	if rc := m["request_count"]; len(rc) > 0 {
		dps := mergeAllDatapoints(rc)
		if len(dps) > 0 {
			st := aggregateSeries(dps)
			s.RequestRateMin = &st.min
			s.RequestRateMax = &st.max
			s.RequestRateAvg = &st.mean
		}
	}
	if s.LatencyP99Avg == nil && s.RequestRateAvg == nil && s.Direction == "" && s.Reporter == "" {
		return nil
	}
	return s
}

func buildOverview(m models.MetricsMap) *Overview {
	o := &Overview{}
	if s := pickMetricStat(m["request_duration_millis"], "avg"); s != nil && len(s.Datapoints) > 0 {
		a := aggregateSeries(s.Datapoints)
		ol := &OverviewLatency{
			AvgMs:      a.mean,
			FlatSeries: isEffectivelyConstant(s.Datapoints),
			StdDevMs:   a.stdDev,
		}
		if p95 := pickMetricStat(m["request_duration_millis"], "0.95"); p95 != nil && len(p95.Datapoints) > 0 {
			mn := aggregateSeries(p95.Datapoints).mean
			ol.P95Ms = &mn
		}
		if p99 := pickMetricStat(m["request_duration_millis"], "0.99"); p99 != nil && len(p99.Datapoints) > 0 {
			mn := aggregateSeries(p99.Datapoints).mean
			ol.P99Ms = &mn
		}
		o.Latency = ol
	}
	if rc := m["request_count"]; len(rc) > 0 {
		dps := mergeAllDatapoints(rc)
		if len(dps) > 0 {
			a := aggregateSeries(dps)
			o.RequestRate = &OverviewRate{
				AvgPerS: a.mean,
				Stable:  isEffectivelyConstant(dps),
			}
		}
	}
	if o.Latency == nil && o.RequestRate == nil {
		return nil
	}
	return o
}

func buildLatencySummary(m models.MetricsMap) *LatencySummary {
	series := m["request_duration_millis"]
	if len(series) == 0 {
		return nil
	}
	order := []string{"0.5", "0.95", "0.99", "0.999", "avg"}
	labels := map[string]string{
		"0.5": "P50", "0.95": "P95", "0.99": "P99", "0.999": "P99.9", "avg": "Avg",
	}
	var rows []QuantileStats
	for _, stat := range order {
		met := pickMetricStat(series, stat)
		if met == nil {
			continue
		}
		st := aggregateSeries(met.Datapoints)
		lbl := labels[stat]
		if lbl == "" {
			lbl = stat
		}
		rows = append(rows, QuantileStats{
			Avg:    st.mean,
			Label:  lbl,
			Max:    st.max,
			Min:    st.min,
			Stat:   stat,
			StdDev: st.stdDev,
		})
	}
	if len(rows) == 0 {
		return nil
	}
	ls := &LatencySummary{Quantiles: rows}
	if avgMet := pickMetricStat(series, "avg"); avgMet != nil && len(avgMet.Datapoints) > 0 {
		ls.Trend = buildTrend("Latency (avg)", avgMet.Datapoints, "ms", trendBuckets)
	} else if p99 := pickMetricStat(series, "0.99"); p99 != nil && len(p99.Datapoints) > 0 {
		ls.Trend = buildTrend("Latency (P99)", p99.Datapoints, "ms", trendBuckets)
	}
	return ls
}

func buildTrafficSummary(m models.MetricsMap) *TrafficSummary {
	rc := m["request_count"]
	if len(rc) == 0 {
		return nil
	}
	dps := mergeAllDatapoints(rc)
	if len(dps) == 0 {
		return nil
	}
	st := aggregateSeries(dps)
	ts := &TrafficSummary{
		SeriesStats: seriesStatsFromAgg(st),
		Stable:      isEffectivelyConstant(dps),
	}
	if !ts.Stable {
		ts.Trend = buildTrend("Request count", dps, "req/s", trendBuckets)
	}
	return ts
}

func buildThroughputBlocks(m models.MetricsMap) []ThroughputBlock {
	var out []ThroughputBlock
	for _, key := range []string{"request_throughput", "response_throughput"} {
		ser := m[key]
		if len(ser) == 0 {
			continue
		}
		dps := mergeAllDatapoints(ser)
		if len(dps) == 0 {
			continue
		}
		st := aggregateSeries(dps)
		stable := isEffectivelyConstant(dps)
		b := ThroughputBlock{
			Name:   key,
			Stable: stable,
			Stats:  seriesStatsFromAgg(st),
			Title:  humanizeMetricTitle(key),
		}
		if !stable {
			b.Trend = buildTrend(b.Title, dps, "B/s", trendBuckets)
		}
		out = append(out, b)
	}
	return out
}

func buildSizeBlocks(m models.MetricsMap) []SizeMetricBlock {
	var out []SizeMetricBlock
	for _, key := range []string{"request_size", "response_size"} {
		ser := m[key]
		if len(ser) == 0 {
			continue
		}
		block := SizeMetricBlock{
			Metric: key,
			Title:  humanizeMetricTitle(key),
		}
		order := []string{"avg", "0.5", "0.95", "0.99"}
		labels := map[string]string{"0.5": "P50", "0.95": "P95", "0.99": "P99", "avg": "Avg"}
		for _, stat := range order {
			met := pickMetricStat(ser, stat)
			if met == nil || len(met.Datapoints) == 0 {
				continue
			}
			st := aggregateSeries(met.Datapoints)
			lbl := labels[stat]
			if lbl == "" {
				lbl = stat
			}
			row := SizeStatRow{
				Constant: isEffectivelyConstant(met.Datapoints),
				Label:    lbl,
				Stats:    seriesStatsFromAgg(st),
			}
			if !row.Constant {
				row.Trend = buildTrend("Trend ("+lbl+")", met.Datapoints, "B", 3)
			}
			block.Stats = append(block.Stats, row)
		}
		if len(block.Stats) > 0 {
			out = append(out, block)
		}
	}
	return out
}

func buildErrorsSummary(m models.MetricsMap) *ErrorsSummary {
	ec := m["request_error_count"]
	if len(ec) == 0 {
		return &ErrorsSummary{EmptySeries: true, ZeroErrors: true}
	}
	dps := mergeAllDatapoints(ec)
	if len(dps) == 0 {
		return &ErrorsSummary{EmptySeries: false, ZeroErrors: true}
	}
	sum := 0.0
	for _, dp := range dps {
		sum += dp.Value
	}
	st := aggregateSeries(dps)
	if sum == 0 && isEffectivelyConstant(dps) {
		return &ErrorsSummary{EmptySeries: false, ZeroErrors: true}
	}
	return &ErrorsSummary{
		EmptySeries: false,
		Max:         st.max,
		Min:         st.min,
		Total:       sum,
		ZeroErrors:  false,
	}
}

func buildGrpcTcpStats(m models.MetricsMap) map[string]SeriesStats {
	keys := []string{"grpc_received", "grpc_sent", "tcp_opened", "tcp_closed", "tcp_received", "tcp_sent"}
	out := make(map[string]SeriesStats)
	for _, k := range keys {
		ser := m[k]
		if len(ser) == 0 {
			continue
		}
		dps := mergeAllDatapoints(ser)
		if len(dps) == 0 {
			continue
		}
		st := aggregateSeries(dps)
		out[k] = seriesStatsFromAgg(st)
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func seriesStatsFromAgg(a aggStats) SeriesStats {
	return SeriesStats{Avg: a.mean, Max: a.max, Min: a.min, StdDev: a.stdDev}
}

func pickMetricStat(series []models.Metric, stat string) *models.Metric {
	for i := range series {
		if series[i].Stat == stat {
			return &series[i]
		}
	}
	return nil
}

func humanizeMetricTitle(key string) string {
	s := strings.ReplaceAll(key, "_", " ")
	parts := strings.Fields(s)
	for i, p := range parts {
		if len(p) == 0 {
			continue
		}
		parts[i] = strings.ToUpper(p[:1]) + strings.ToLower(p[1:])
	}
	return strings.Join(parts, " ")
}

func mergeAllDatapoints(series []models.Metric) []models.Datapoint {
	var out []models.Datapoint
	for i := range series {
		out = append(out, series[i].Datapoints...)
	}
	if len(out) == 0 {
		return nil
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Timestamp < out[j].Timestamp })
	return out
}

type aggStats struct {
	min, max, mean, stdDev float64
}

func aggregateSeries(dps []models.Datapoint) aggStats {
	vals := make([]float64, 0, len(dps))
	for _, dp := range dps {
		v := dp.Value
		if !math.IsNaN(v) && !math.IsInf(v, 0) {
			vals = append(vals, v)
		}
	}
	if len(vals) == 0 {
		return aggStats{}
	}
	minV := vals[0]
	maxV := vals[0]
	sum := 0.0
	for _, v := range vals {
		if v < minV {
			minV = v
		}
		if v > maxV {
			maxV = v
		}
		sum += v
	}
	n := float64(len(vals))
	mean := sum / n
	var varSum float64
	for _, v := range vals {
		d := v - mean
		varSum += d * d
	}
	return aggStats{
		min:    minV,
		max:    maxV,
		mean:   mean,
		stdDev: math.Sqrt(varSum / n),
	}
}

func isEffectivelyConstant(dps []models.Datapoint) bool {
	if len(dps) <= 1 {
		return true
	}
	st := aggregateSeries(dps)
	if st.max-st.min <= stableAbsTolerance {
		return true
	}
	if math.Abs(st.mean) < stableAbsTolerance {
		return st.max-st.min < stableAbsTolerance
	}
	return (st.max-st.min)/math.Abs(st.mean) < stableRangeToMean
}

func bucketAverages(dps []models.Datapoint, numBuckets int) []float64 {
	if len(dps) == 0 || numBuckets < 1 {
		return nil
	}
	sort.Slice(dps, func(i, j int) bool { return dps[i].Timestamp < dps[j].Timestamp })
	t0 := float64(dps[0].Timestamp)
	t1 := float64(dps[len(dps)-1].Timestamp)
	span := t1 - t0
	if span <= 0 {
		a := aggregateSeries(dps).mean
		out := make([]float64, numBuckets)
		for i := range out {
			out[i] = a
		}
		return out
	}
	buckets := make([][]float64, numBuckets)
	for _, dp := range dps {
		idx := int((float64(dp.Timestamp) - t0) / span * float64(numBuckets))
		if idx >= numBuckets {
			idx = numBuckets - 1
		}
		if idx < 0 {
			idx = 0
		}
		buckets[idx] = append(buckets[idx], dp.Value)
	}
	out := make([]float64, numBuckets)
	for i := range buckets {
		if len(buckets[i]) == 0 {
			out[i] = math.NaN()
			continue
		}
		var s float64
		for _, v := range buckets[i] {
			s += v
		}
		out[i] = s / float64(len(buckets[i]))
	}
	for i := range out {
		if !math.IsNaN(out[i]) {
			continue
		}
		left, right := -1.0, -1.0
		for j := i - 1; j >= 0; j-- {
			if !math.IsNaN(out[j]) {
				left = out[j]
				break
			}
		}
		for j := i + 1; j < len(out); j++ {
			if !math.IsNaN(out[j]) {
				right = out[j]
				break
			}
		}
		switch {
		case left >= 0 && right >= 0:
			out[i] = (left + right) / 2
		case left >= 0:
			out[i] = left
		default:
			out[i] = right
		}
	}
	return out
}

func buildTrend(title string, dps []models.Datapoint, unit string, buckets int) *TrendSummary {
	avgs := bucketAverages(dps, buckets)
	if len(avgs) < 2 {
		return nil
	}
	start, end := avgs[0], avgs[len(avgs)-1]
	maxV, maxIdx := avgs[0], 0
	for i, v := range avgs {
		if v > maxV {
			maxV, maxIdx = v, i
		}
	}
	pattern := "flat"
	switch {
	case maxV > start*1.05 && maxIdx < len(avgs)-1:
		pattern = "spike_before_end"
	case end > start*1.05:
		pattern = "rising"
	case start > end*1.05:
		pattern = "falling"
	}
	return &TrendSummary{
		BucketAverages: avgs,
		BucketCount:    buckets,
		EndValue:       end,
		MaxBucketIndex: maxIdx,
		MaxValue:       maxV,
		Pattern:        pattern,
		StartValue:     start,
		Title:          title,
		Unit:           unit,
	}
}
