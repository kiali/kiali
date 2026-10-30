package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gogo/protobuf/proto"
	"github.com/golang/snappy"
	"github.com/prometheus/prometheus/prompb"
)

const (
	metricPromptTotal             = "kiali_ai_prompt_tokens_total"
	metricCompletionTotal         = "kiali_ai_completion_tokens_total"
	metricTotalTokensTotal        = "kiali_ai_total_tokens_total"
	metricPromptWeeklyTotal       = "kiali_ai_prompt_tokens_weekly_total"
	metricCompletionWeeklyTotal   = "kiali_ai_completion_tokens_weekly_total"
	metricTotalTokensWeeklyTotal  = "kiali_ai_tokens_weekly_total"
	metricPromptMonthlyTotal      = "kiali_ai_prompt_tokens_monthly_total"
	metricCompletionMonthlyTotal  = "kiali_ai_completion_tokens_monthly_total"
	metricTotalTokensMonthlyTotal = "kiali_ai_tokens_monthly_total"
	metricRequestsTotal           = "kiali_ai_requests_total"

	metricRequestDurationCount    = "kiali_ai_request_duration_seconds_count"
	metricRequestDurationSum      = "kiali_ai_request_duration_seconds_sum"
	metricRequestDurationBucket   = "kiali_ai_request_duration_seconds_bucket"
	metricStoreConversationsTotal = "kiali_ai_store_conversations_total"
	metricStoreEvictionsTotal     = "kiali_ai_store_evictions_total"

	weeklyBuckets  = 12
	monthlyBuckets = 12

	requestChat            = "chat"
	requestTroubleshooting = "troubleshooting"

	maxOutOfOrderWindow = 35 * 24 * time.Hour
	injectHorizon       = 34 * 24 * time.Hour

	// Defaults align with common Kiali usage queries (window=30d, step=1h)
	defaultHistoryHours = 720.0
	defaultHistoryStep  = 30 * time.Minute
)

type tokenValues struct {
	prompt     float64
	completion float64
}

func (t tokenValues) scale(factor float64) tokenValues {
	return tokenValues{prompt: t.prompt * factor, completion: t.completion * factor}
}

func (t tokenValues) total() float64 {
	return t.prompt + t.completion
}

type providerConfig struct {
	provider            string
	model               string
	username            string
	promptBase          float64
	completionBase      float64
	reqBase             float64
	promptIncrement     float64 // added per history-step sample (cumulative counter)
	completionIncrement float64
	reqIncrement        float64
	weekStep            float64
	monthStep           float64
}

type promQueryResponse struct {
	Status string `json:"status"`
	Data   struct {
		Result []struct {
			Value []interface{} `json:"value"`
		} `json:"result"`
	} `json:"data"`
}

// seriesRegistry groups samples by metric+labels into a single remote-write series.
type seriesRegistry struct {
	series map[string]*prompb.TimeSeries
}

func newSeriesRegistry() *seriesRegistry {
	return &seriesRegistry{series: map[string]*prompb.TimeSeries{}}
}

func (r *seriesRegistry) addSample(metricName string, extraLabels []prompb.Label, value float64, timestampMs int64) {
	key := seriesKey(metricName, extraLabels)
	existing, ok := r.series[key]
	if !ok {
		labels := []prompb.Label{{Name: "__name__", Value: metricName}}
		labels = append(labels, extraLabels...)
		existing = &prompb.TimeSeries{Labels: labels}
		r.series[key] = existing
	}
	if n := len(existing.Samples); n > 0 && existing.Samples[n-1].Timestamp == timestampMs {
		existing.Samples[n-1].Value = value
		return
	}
	existing.Samples = append(existing.Samples, prompb.Sample{
		Value:     value,
		Timestamp: timestampMs,
	})
}

func (r *seriesRegistry) toSlice() []prompb.TimeSeries {
	out := make([]prompb.TimeSeries, 0, len(r.series))
	for _, ts := range r.series {
		ts.Samples = collapseSamples(ts.Samples)
		out = append(out, *ts)
	}
	return out
}

// collapseSamples sorts by time and merges samples that share a timestamp.
// Request and duration series have no username, so two mock users of the same
// provider and model write the same series. Prometheus rejects that write when
// both samples keep the timestamp. Counters are summed.
func collapseSamples(samples []prompb.Sample) []prompb.Sample {
	if len(samples) < 2 {
		return samples
	}
	sort.Slice(samples, func(i, j int) bool {
		return samples[i].Timestamp < samples[j].Timestamp
	})
	out := samples[:1:1]
	for _, sample := range samples[1:] {
		last := &out[len(out)-1]
		if last.Timestamp == sample.Timestamp {
			last.Value += sample.Value
			continue
		}
		out = append(out, sample)
	}
	return out
}

func seriesKey(metricName string, labels []prompb.Label) string {
	parts := make([]string, 0, len(labels)+1)
	parts = append(parts, metricName)
	for _, label := range labels {
		parts = append(parts, label.Name+"="+label.Value)
	}
	sort.Strings(parts[1:])
	return strings.Join(parts, "|")
}

func main() {
	portFlag := flag.Int("port", 0, "Local Prometheus port (e.g., 9090)")
	urlFlag := flag.String("url", "", "Prometheus base URL (e.g., http://localhost:9090)")
	historyHoursFlag := flag.Float64("history-hours", defaultHistoryHours, "Recent history window in hours for cumulative base counters (0 = only inject at current time)")
	historyStepFlag := flag.Duration("history-step", defaultHistoryStep, "Step between cumulative counter samples when history-hours > 0")
	forceFlag := flag.Bool("force", false, "Inject even if metrics for a provider already exist")
	cleanFlag := flag.Bool("clean", false, "Delete all Kiali AI metrics from Prometheus and exit")
	flag.Parse()

	var baseURL string
	switch {
	case *urlFlag != "":
		baseURL = *urlFlag
	case *portFlag != 0:
		baseURL = fmt.Sprintf("http://localhost:%d", *portFlag)
	default:
		baseURL = "http://localhost:9090"
	}

	client := &http.Client{Timeout: 10 * time.Second}

	if *cleanFlag {
		fmt.Printf("Cleaning AI metrics from %s...\n", baseURL)
		cleanMetrics(client, baseURL)
		return
	}

	writeURL := fmt.Sprintf("%s/api/v1/write", baseURL)
	fmt.Printf("Injecting AI metrics to %s...\n", writeURL)

	now := time.Now()
	registry := newSeriesRegistry()

	configs := []providerConfig{
		{
			provider: "openai", model: "gpt-4o", username: "anonymous",
			promptBase: 1200000, completionBase: 600000, reqBase: 600,
			promptIncrement: 550000, completionIncrement: 280000, reqIncrement: 10,
			weekStep: 110000, monthStep: 320000,
		},
		{
			provider: "anthropic", model: "claude-sonnet-4-6", username: "anonymous",
			promptBase: 1800000, completionBase: 720000, reqBase: 700,
			promptIncrement: 700000, completionIncrement: 350000, reqIncrement: 10,
			weekStep: 220000, monthStep: 520000,
		},
		{
			provider: "openai", model: "gpt-4o", username: "anonymous-shared",
			promptBase: 1100000, completionBase: 550000, reqBase: 500,
			promptIncrement: 500000, completionIncrement: 250000, reqIncrement: 10,
			weekStep: 100000, monthStep: 300000,
		},
		{
			provider: "anthropic", model: "claude-sonnet-4-6", username: "anonymous-shared",
			promptBase: 1650000, completionBase: 660000, reqBase: 650,
			promptIncrement: 640000, completionIncrement: 320000, reqIncrement: 10,
			weekStep: 200000, monthStep: 480000,
		},
		{
			provider: "anthropic", model: "claude-opus-5", username: "kiali_user",
			promptBase: 2400000, completionBase: 960000, reqBase: 900,
			promptIncrement: 850000, completionIncrement: 420000, reqIncrement: 10,
			weekStep: 260000, monthStep: 620000,
		},
		{
			provider: "google", model: "gemini-3.1-pro-preview", username: "kiali_user",
			promptBase: 1600000, completionBase: 700000, reqBase: 700,
			promptIncrement: 650000, completionIncrement: 320000, reqIncrement: 10,
			weekStep: 190000, monthStep: 470000,
		},
		{
			provider: "openai", model: "gpt-5.6-sol", username: "kubeadmin",
			promptBase: 3000000, completionBase: 1200000, reqBase: 1200,
			promptIncrement: 950000, completionIncrement: 480000, reqIncrement: 20,
			weekStep: 300000, monthStep: 750000,
		},
		{
			provider: "google", model: "gemini-3.6-flash", username: "kubeadmin",
			promptBase: 2200000, completionBase: 900000, reqBase: 1000,
			promptIncrement: 750000, completionIncrement: 380000, reqIncrement: 10,
			weekStep: 240000, monthStep: 580000,
		},
	}

	var injectedProviders, skippedProviders int

	for _, cfg := range configs {
		for _, requestKind := range []string{requestChat, requestTroubleshooting} {
			requestCfg := cfg
			if requestKind == requestTroubleshooting {
				requestCfg = scaleProviderConfig(cfg, troubleshootingFactor(cfg))
			}
			if !*forceFlag {
				exists, err := providerMetricsExist(client, baseURL, requestCfg, requestKind)
				if err != nil {
					log.Printf("Warning: could not check existing metrics for %s/%s request=%s: %v", requestCfg.provider, requestCfg.model, requestKind, err)
				} else if exists {
					fmt.Printf("Skipping %s/%s (%s) request=%s: metrics already exist in Prometheus\n", requestCfg.provider, requestCfg.model, requestCfg.username, requestKind)
					skippedProviders++
					continue
				}
			}

			samples := injectProviderRequest(registry, requestCfg, requestKind, now, *historyHoursFlag, *historyStepFlag)
			fmt.Printf("Prepared metrics for %s/%s (%s) request=%s: %d usage samples, %d weekly buckets, %d monthly buckets\n",
				requestCfg.provider, requestCfg.model, requestCfg.username, requestKind, samples, weeklyBuckets, monthlyBuckets)
			injectedProviders++
		}
	}

	// Inject global store metrics (no labels) over the same history window
	if injectedProviders > 0 || *forceFlag {
		historyDuration := time.Duration(*historyHoursFlag * float64(time.Hour))
		historyStart := now.Add(-historyDuration).Truncate(*historyStepFlag)
		steps := int(historyDuration / *historyStepFlag)
		if *historyHoursFlag <= 0 {
			historyStart = now
			steps = 0
		}

		evictions := 10.0
		for i := 0; i <= steps; i++ {
			sampleTime := historyStart.Add(time.Duration(i) * *historyStepFlag)
			if sampleTime.After(now) {
				sampleTime = now
			}

			conversations := 15.0 + float64(i%5) // Gauge that fluctuates
			registry.addSample(metricStoreConversationsTotal, nil, conversations, sampleTime.UnixMilli())
			registry.addSample(metricStoreEvictionsTotal, nil, evictions, sampleTime.UnixMilli())

			evictions += 2.0 // Counter that grows
		}
	}

	timeseries := registry.toSlice()
	if len(timeseries) == 0 {
		fmt.Printf("No new metrics to inject (%d series skipped).\n", skippedProviders)
		return
	}

	// Send each request label on its own. A duplicate timestamp in one group used
	// to reject the whole payload, so troubleshooting never landed.
	if err := writeSeriesGroups(client, writeURL, timeseries); err != nil {
		if !strings.Contains(err.Error(), "duplicate sample") {
			log.Fatalf("Failed to inject metrics: %v\nNote: Make sure Prometheus is started with --web.enable-remote-write-receiver", err)
		}
		fmt.Println("Prometheus already has AI samples at these timestamps. Cleaning and retrying once...")
		cleanMetrics(client, baseURL)
		if err := writeSeriesGroups(client, writeURL, timeseries); err != nil {
			log.Fatalf("Failed to inject metrics after clean: %v\nIf this is still a duplicate sample, restart Prometheus so deleted series are gone.", err)
		}
	}
	fmt.Printf("Successfully injected %d time series for %d request series (%d skipped).\n", len(timeseries), injectedProviders, skippedProviders)
}

func writeSeriesGroups(client *http.Client, writeURL string, timeseries []prompb.TimeSeries) error {
	// Request and duration series have no username, so several mock users share
	// one series. Those counters may already be in Prometheus. Keep them in their
	// own write: a duplicate there must not reject the token series the charts use.
	groups := map[string][]prompb.TimeSeries{}
	for _, ts := range timeseries {
		groups[seriesClass(ts)] = append(groups[seriesClass(ts)], ts)
	}
	order := []string{
		"tokens-" + requestTroubleshooting,
		"tokens-" + requestChat,
		"requests",
		"other",
	}
	seen := map[string]bool{}
	var errs []string
	writeKind := func(kind string, series []prompb.TimeSeries) {
		if err := writeSeries(client, writeURL, series); err != nil {
			if kind == "requests" && strings.Contains(err.Error(), "duplicate sample") {
				log.Printf("Warning: skipped request/duration series already stored in Prometheus: %v", err)
				return
			}
			errs = append(errs, fmt.Sprintf("%s: %v", kind, err))
		}
	}
	for _, kind := range order {
		seen[kind] = true
		writeKind(kind, groups[kind])
	}
	for kind, series := range groups {
		if seen[kind] {
			continue
		}
		writeKind(kind, series)
	}
	if len(errs) == 0 {
		return nil
	}
	return fmt.Errorf("%s", strings.Join(errs, "; "))
}

func seriesClass(ts prompb.TimeSeries) string {
	name := ""
	for _, label := range ts.Labels {
		if label.Name == "__name__" {
			name = label.Value
			break
		}
	}
	if strings.Contains(name, "requests_total") || strings.Contains(name, "duration_seconds") {
		return "requests"
	}
	if request := seriesRequest(ts); request != "" {
		return "tokens-" + request
	}
	return "other"
}

func seriesRequest(ts prompb.TimeSeries) string {
	for _, label := range ts.Labels {
		if label.Name == "request" {
			return label.Value
		}
	}
	return ""
}

func requestGroupName(kind string) string {
	if kind == "" {
		return "unlabeled"
	}
	return kind
}

func writeSeries(client *http.Client, writeURL string, timeseries []prompb.TimeSeries) error {
	if len(timeseries) == 0 {
		return nil
	}
	req := &prompb.WriteRequest{Timeseries: timeseries}
	data, err := proto.Marshal(req)
	if err != nil {
		return fmt.Errorf("marshal protobuf: %w", err)
	}
	httpReq, err := http.NewRequest("POST", writeURL, bytes.NewReader(snappy.Encode(nil, data)))
	if err != nil {
		return err
	}
	httpReq.Header.Set("Content-Encoding", "snappy")
	httpReq.Header.Set("Content-Type", "application/x-protobuf")
	httpReq.Header.Set("X-Prometheus-Remote-Write-Version", "0.1.0")

	resp, err := client.Do(httpReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(body))
	}
	fmt.Printf("Injected %d time series for request=%s.\n", len(timeseries), requestGroupName(seriesRequest(timeseries[0])))
	return nil
}

func providerMetricsExist(client *http.Client, baseURL string, cfg providerConfig, request string) (bool, error) {
	query := fmt.Sprintf(
		`last_over_time(%s{username=%q,ai_provider=%q,ai_model=%q,request=%q}[35d])`,
		metricTotalTokensTotal,
		cfg.username,
		cfg.provider,
		cfg.model,
		request,
	)
	return prometheusQueryHasResults(client, baseURL, query)
}

func requestLabels(cfg providerConfig, request string) (labelsBase, labelsRequest []prompb.Label) {
	labelsBase = []prompb.Label{
		{Name: "username", Value: cfg.username},
		{Name: "ai_provider", Value: cfg.provider},
		{Name: "ai_model", Value: cfg.model},
		{Name: "request", Value: request},
	}
	labelsRequest = []prompb.Label{
		{Name: "ai_provider", Value: cfg.provider},
		{Name: "ai_model", Value: cfg.model},
		{Name: "request", Value: request},
	}
	return labelsBase, labelsRequest
}

func scaleProviderConfig(cfg providerConfig, factor float64) providerConfig {
	cfg.promptBase *= factor
	cfg.completionBase *= factor
	cfg.reqBase *= factor
	cfg.promptIncrement *= factor
	cfg.completionIncrement *= factor
	cfg.reqIncrement *= factor
	cfg.weekStep *= factor
	cfg.monthStep *= factor
	return cfg
}

// troubleshootingFactor keeps troubleshooting smaller than chat, and different
// for each provider, so the two request series separate on a chart.
func troubleshootingFactor(cfg providerConfig) float64 {
	switch cfg.provider + "/" + cfg.model + "/" + cfg.username {
	case "openai/gpt-4o/anonymous":
		return 0.18
	case "anthropic/claude-sonnet-4-6/anonymous":
		return 0.42
	case "openai/gpt-4o/anonymous-shared":
		return 0.27
	case "anthropic/claude-sonnet-4-6/anonymous-shared":
		return 0.55
	case "anthropic/claude-opus-5/kiali_user":
		return 0.15
	case "google/gemini-3.1-pro-preview/kiali_user":
		return 0.63
	case "openai/gpt-5.6-sol/kubeadmin":
		return 0.33
	case "google/gemini-3.6-flash/kubeadmin":
		return 0.48
	default:
		return 0.3
	}
}

func injectProviderRequest(
	registry *seriesRegistry,
	cfg providerConfig,
	request string,
	now time.Time,
	historyHours float64,
	historyStep time.Duration,
) int {
	labelsBase, labelsRequest := requestLabels(cfg, request)

	// Cumulative base counters over a recent window ending at now.
	// Kiali reconstructs usage time series from increase(metric[1h]) over this data.
	// Prometheus remote-write may reject timestamps too far in the past.
	samples := injectCumulativeCounters(registry, cfg, labelsBase, labelsRequest, now, historyHours, historyStep)

	// Weekly buckets for the last 12 weeks.
	// Each year/week series is usage for that week only: 0 at week start,
	// then the week's tokens (not a lifetime running total).
	for i := 0; i < weeklyBuckets; i++ {
		t := now.AddDate(0, 0, -7*i)
		year, week := t.ISOWeek()
		labelsWeekly := append(append([]prompb.Label{}, labelsBase...),
			prompb.Label{Name: "year", Value: strconv.Itoa(year)},
			prompb.Label{Name: "week", Value: strconv.Itoa(week)},
		)
		weekStart := isoWeekToTime(year, week)
		weekEnd := weekStart.Add(7 * 24 * time.Hour)
		fromOldest := weeklyBuckets - 1 - i
		fullUsage := periodUsage(cfg.weekStep, fromOldest, weeklyBuckets)
		step := time.Duration(0)
		if i == 0 {
			step = historyStep
		}
		injectPeriodCounter(
			registry,
			metricPromptWeeklyTotal,
			metricCompletionWeeklyTotal,
			metricTotalTokensWeeklyTotal,
			labelsWeekly,
			weekStart,
			weekEnd,
			now,
			fullUsage,
			step,
		)
	}

	// Monthly buckets for the last 12 months.
	// Each year/month series is usage for that month only and starts at zero.
	for i := 0; i < monthlyBuckets; i++ {
		t := now.AddDate(0, -i, 0)
		monthStart := time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC)
		monthEnd := monthStart.AddDate(0, 1, 0)
		labelsMonthly := append(append([]prompb.Label{}, labelsBase...),
			prompb.Label{Name: "year", Value: strconv.Itoa(monthStart.Year())},
			prompb.Label{Name: "month", Value: strconv.Itoa(int(monthStart.Month()))},
		)
		fromOldest := monthlyBuckets - 1 - i
		fullUsage := periodUsage(cfg.monthStep, fromOldest, monthlyBuckets)
		step := time.Duration(0)
		if i == 0 {
			step = historyStep
		}
		injectPeriodCounter(
			registry,
			metricPromptMonthlyTotal,
			metricCompletionMonthlyTotal,
			metricTotalTokensMonthlyTotal,
			labelsMonthly,
			monthStart,
			monthEnd,
			now,
			fullUsage,
			step,
		)
	}

	return samples
}

func prometheusQueryHasResults(client *http.Client, baseURL, query string) (bool, error) {
	queryURL := fmt.Sprintf("%s/api/v1/query?query=%s", strings.TrimRight(baseURL, "/"), url.QueryEscape(query))
	resp, err := client.Get(queryURL)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return false, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return false, fmt.Errorf("prometheus query failed with HTTP %d: %s", resp.StatusCode, string(body))
	}

	var parsed promQueryResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return false, err
	}
	if parsed.Status != "success" {
		return false, fmt.Errorf("prometheus query status: %s", parsed.Status)
	}

	return len(parsed.Data.Result) > 0, nil
}

// injectCumulativeCounters writes monotonically increasing counter samples for the
// base token and request metrics. Each sample adds promptIncrement/completionIncrement/
// reqIncrement to the running total so Prometheus increase() returns non-zero deltas.
func injectCumulativeCounters(
	registry *seriesRegistry,
	cfg providerConfig,
	labelsBase, labelsRequest []prompb.Label,
	now time.Time,
	historyHours float64,
	historyStep time.Duration,
) int {
	injectAt := func(sampleTime time.Time, prompt, completion, requests float64) {
		addTokenFamily(
			registry,
			metricPromptTotal,
			metricCompletionTotal,
			metricTotalTokensTotal,
			labelsBase,
			tokenValues{prompt: prompt, completion: completion},
			sampleTime.UnixMilli(),
		)
		registry.addSample(metricRequestsTotal, labelsRequest, requests, sampleTime.UnixMilli())

		// Histogram for request duration
		registry.addSample(metricRequestDurationCount, labelsRequest, requests, sampleTime.UnixMilli())
		registry.addSample(metricRequestDurationSum, labelsRequest, requests*1.5, sampleTime.UnixMilli())

		bucketLabels := append(append([]prompb.Label(nil), labelsRequest...), prompb.Label{Name: "le", Value: "+Inf"})
		registry.addSample(metricRequestDurationBucket, bucketLabels, requests, sampleTime.UnixMilli())
	}

	if historyHours <= 0 {
		injectAt(now, cfg.promptBase, cfg.completionBase, cfg.reqBase)
		return 1
	}

	historyDuration := time.Duration(historyHours * float64(time.Hour))
	historyStart := now.Add(-historyDuration).Truncate(historyStep)
	steps := int(historyDuration / historyStep)

	prompt := cfg.promptBase
	completion := cfg.completionBase
	requests := cfg.reqBase
	sampleCount := 0

	for i := 0; i <= steps; i++ {
		sampleTime := historyStart.Add(time.Duration(i) * historyStep)
		if sampleTime.After(now) {
			sampleTime = now
		}
		injectAt(sampleTime, prompt, completion, requests)
		sampleCount++

		// Add some non-linear exponential growth
		// 1.002^i makes the increment grow exponentially, but much slower
		growthFactor := 1.0
		for j := 0; j < i; j++ {
			growthFactor *= 1.002
		}

		prompt += cfg.promptIncrement * growthFactor
		completion += cfg.completionIncrement * growthFactor
		requests += cfg.reqIncrement * growthFactor
	}

	return sampleCount
}

func addTokenFamily(
	registry *seriesRegistry,
	promptMetric string,
	completionMetric string,
	totalMetric string,
	labels []prompb.Label,
	values tokenValues,
	timestampMs int64,
) {
	registry.addSample(promptMetric, labels, values.prompt, timestampMs)
	registry.addSample(completionMetric, labels, values.completion, timestampMs)
	registry.addSample(totalMetric, labels, values.total(), timestampMs)
}

func cleanMetrics(client *http.Client, baseURL string) {
	deleteURL := fmt.Sprintf("%s/api/v1/admin/tsdb/delete_series?match[]=%s", strings.TrimRight(baseURL, "/"), url.QueryEscape("{__name__=~\"kiali_ai_.*\"}"))
	req, err := http.NewRequest("POST", deleteURL, nil)
	if err != nil {
		log.Fatalf("Failed to create HTTP request for clean: %v", err)
	}

	resp, err := client.Do(req)
	if err != nil {
		log.Fatalf("Failed to send clean request: %v", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		fmt.Println("Successfully sent delete request to Prometheus.")
		fmt.Println("Note: Prometheus may not immediately delete out-of-order historical data.")
		fmt.Println("If you still see old metrics or get 'duplicate sample' errors, restart your Prometheus pod:")
		fmt.Println("  kubectl delete pod -n istio-system -l app.kubernetes.io/name=prometheus")

		// Clean tombstones to immediately free up space and make sure subsequent injections don't conflict
		cleanTombstonesURL := fmt.Sprintf("%s/api/v1/admin/tsdb/clean_tombstones", strings.TrimRight(baseURL, "/"))
		cleanReq, _ := http.NewRequest("POST", cleanTombstonesURL, nil)
		cleanResp, err := client.Do(cleanReq)
		if err == nil {
			cleanResp.Body.Close()
		}
	} else {
		log.Fatalf("Failed to delete metrics. HTTP %d: %s\nNote: Make sure Prometheus is started with --web.enable-admin-api", resp.StatusCode, string(body))
	}
}

func periodUsage(step float64, indexFromOldest, periods int) tokenValues {
	volume := 1.0
	if periods > 1 {
		volume = 0.12 + 0.88*float64(indexFromOldest)/float64(periods-1)
	}
	return tokenValues{
		prompt:     step * volume,
		completion: (step / 2) * volume,
	}
}

func elapsedFraction(start, end, now time.Time) float64 {
	if !end.After(start) {
		return 1
	}
	if !now.After(start) {
		return 0
	}
	if !now.Before(end) {
		return 1
	}
	return float64(now.Sub(start)) / float64(end.Sub(start))
}

func clampInjectTime(t, now time.Time) time.Time {
	if t.After(now) {
		return now
	}
	if now.Sub(t) > maxOutOfOrderWindow {
		return now.Add(-injectHorizon)
	}
	return t
}

func injectPeriodCounter(
	registry *seriesRegistry,
	promptMetric string,
	completionMetric string,
	totalMetric string,
	labels []prompb.Label,
	start, end, now time.Time,
	fullUsage tokenValues,
	step time.Duration,
) {
	startT := clampInjectTime(start, now)
	endT := clampInjectTime(end, now)
	if endT.Before(startT) {
		endT = startT
	}

	addAt := func(sampleTime time.Time, values tokenValues) {
		addTokenFamily(registry, promptMetric, completionMetric, totalMetric, labels, values, sampleTime.UnixMilli())
	}

	if !endT.After(startT) {
		addAt(endT, fullUsage.scale(elapsedFraction(start, end, now)))
		return
	}

	addAt(startT, tokenValues{})
	if step > 0 {
		for sample := start.Add(step); sample.Before(now) && sample.Before(end); sample = sample.Add(step) {
			addAt(clampInjectTime(sample, now), fullUsage.scale(elapsedFraction(start, end, sample)))
		}
	}
	addAt(endT, fullUsage.scale(elapsedFraction(start, end, now)))
}

func isoWeekToTime(year, week int) time.Time {
	t := time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC)
	for t.Weekday() != time.Thursday {
		t = t.AddDate(0, 0, 1)
	}
	t = t.AddDate(0, 0, -3)
	return t.AddDate(0, 0, (week-1)*7)
}
