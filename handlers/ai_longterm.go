package handlers

import (
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"time"

	prom_v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
)

const defaultUserUsageBuckets = 4

func handleLongTermChatUsage(w http.ResponseWriter, r *http.Request, conf *config.Config, windowStr, requestStr string, promClient prometheus.ClientInterface) {
	data, status, err := getAILongTermUsageData(r, conf, windowStr, requestStr, "", promClient)
	if err != nil {
		RespondWithError(w, status, err.Error())
		return
	}
	RespondWithJSON(w, http.StatusOK, data)
}

// lastNBucketRange returns the [from, since] range covering the current bucket
// plus the previous n-1 weekly or monthly buckets.
func lastNBucketRange(interval config.BudgetInterval, n int, now time.Time) (time.Time, time.Time) {
	now = now.UTC()
	if n <= 0 {
		n = defaultUserUsageBuckets
	}
	since := now.Add(time.Second)
	if interval == config.MonthlyBudget {
		start := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
		return start.AddDate(0, -(n - 1), 0), since
	}
	year, week := now.ISOWeek()
	weekStart := isoWeekToTime(year, week)
	return weekStart.AddDate(0, 0, -7*(n-1)), since
}

// fetchCurrentPeriodHourly loads the current budget period from weekly/monthly
// counters. Lifetime kiali_ai_*_tokens_total increase() includes prior weeks and
// must not be used here: that is why the chart can exceed remaining tokens.
func fetchCurrentPeriodHourly(
	r *http.Request,
	conf *config.Config,
	username string,
	interval config.BudgetInterval,
	from, since time.Time,
	stepSecs int,
	promClient prometheus.ClientInterface,
) *aiUsageResponse {
	if promClient == nil {
		return nil
	}
	if stepSecs <= 0 {
		stepSecs = currentWeekStepSecs
	}

	now := time.Now().UTC()
	metricTotal := "kiali_ai_tokens_weekly_total"
	metricPrompt := "kiali_ai_prompt_tokens_weekly_total"
	metricCompletion := "kiali_ai_completion_tokens_weekly_total"
	queryLabels := ""
	if interval == config.MonthlyBudget {
		metricTotal = "kiali_ai_tokens_monthly_total"
		metricPrompt = "kiali_ai_prompt_tokens_monthly_total"
		metricCompletion = "kiali_ai_completion_tokens_monthly_total"
		queryLabels = fmt.Sprintf("username=%q,request=%q,year=%q,month=%q", username, "chat", strconv.Itoa(now.Year()), strconv.Itoa(int(now.Month())))
	} else {
		year, week := now.ISOWeek()
		queryLabels = fmt.Sprintf("username=%q,request=%q,year=%q,week=%q", username, "chat", strconv.Itoa(year), strconv.Itoa(week))
	}
	selector := fmt.Sprintf("{%s}", queryLabels)

	api := promClient.API()
	queryInstant := func(metricName string) model.Vector {
		query := fmt.Sprintf("last_over_time(%s%s[35d])", metricName, selector)
		result, warnings, err := api.Query(r.Context(), query, since)
		if len(warnings) > 0 {
			log.Warningf("fetchCurrentPeriodHourly: warnings querying %s: %v", metricName, warnings)
		}
		if err != nil {
			log.Errorf("fetchCurrentPeriodHourly: failed to query prometheus for %s: %v", metricName, err)
			return nil
		}
		vec, ok := result.(model.Vector)
		if !ok {
			return nil
		}
		return vec
	}
	queryRangeMetric := func(metricName string) model.Matrix {
		query := fmt.Sprintf("increase(%s%s[%ds])", metricName, selector, stepSecs)
		result, warnings, err := api.QueryRange(r.Context(), query, prom_v1.Range{
			Start: from,
			End:   since,
			Step:  time.Duration(stepSecs) * time.Second,
		})
		if len(warnings) > 0 {
			log.Warningf("fetchCurrentPeriodHourly: warnings querying %s range: %v", metricName, warnings)
		}
		if err != nil {
			log.Errorf("fetchCurrentPeriodHourly: failed to query prometheus for %s range: %v", metricName, err)
			return nil
		}
		mat, ok := result.(model.Matrix)
		if !ok {
			return nil
		}
		return mat
	}

	type bucketKey struct {
		model    string
		provider string
		ts       time.Time
	}
	type bucketAccum struct {
		completionTokens float64
		cost             *aiCost
		promptTokens     float64
		totalTokens      float64
	}
	summaryBuckets := map[bucketKey]*bucketAccum{}
	rangeBuckets := map[bucketKey]*bucketAccum{}

	accumVec := func(vec model.Vector, field string) {
		if vec == nil {
			return
		}
		for _, sample := range vec {
			provider := string(sample.Metric[model.LabelName("ai_provider")])
			aiModel := string(sample.Metric[model.LabelName("ai_model")])
			key := bucketKey{model: aiModel, provider: provider}
			if summaryBuckets[key] == nil {
				summaryBuckets[key] = &bucketAccum{}
			}
			val := float64(sample.Value)
			switch field {
			case "completion":
				summaryBuckets[key].completionTokens += val
			case "prompt":
				summaryBuckets[key].promptTokens += val
			default:
				summaryBuckets[key].totalTokens += val
			}
		}
	}
	accumMat := func(mat model.Matrix, field string) {
		if mat == nil {
			return
		}
		for _, series := range mat {
			provider := string(series.Metric[model.LabelName("ai_provider")])
			aiModel := string(series.Metric[model.LabelName("ai_model")])
			for _, point := range series.Values {
				val := float64(point.Value)
				if val <= 0 {
					continue
				}
				key := bucketKey{model: aiModel, provider: provider, ts: point.Timestamp.Time().UTC()}
				if rangeBuckets[key] == nil {
					rangeBuckets[key] = &bucketAccum{}
				}
				switch field {
				case "completion":
					rangeBuckets[key].completionTokens += val
				case "prompt":
					rangeBuckets[key].promptTokens += val
				default:
					rangeBuckets[key].totalTokens += val
				}
			}
		}
	}

	accumVec(queryInstant(metricTotal), "total")
	accumVec(queryInstant(metricPrompt), "prompt")
	accumVec(queryInstant(metricCompletion), "completion")
	accumMat(queryRangeMetric(metricTotal), "total")
	accumMat(queryRangeMetric(metricPrompt), "prompt")
	accumMat(queryRangeMetric(metricCompletion), "completion")

	if conf.AI.Metrics {
		for _, buckets := range []map[bucketKey]*bucketAccum{summaryBuckets, rangeBuckets} {
			for key, bucket := range buckets {
				bucket.cost = calculateCost(conf, key.provider, key.model, int64(bucket.promptTokens), int64(bucket.completionTokens))
			}
		}
	}

	byProviderMap := map[string]*aiTokenRow{}
	byModelMap := map[string]*aiTokenRow{}
	for key, bucket := range summaryBuckets {
		cost := bucket.cost
		addToRow(byProviderMap, key.provider, func(row *aiTokenRow) {
			row.Provider = key.provider
		}, int64(bucket.promptTokens), int64(bucket.completionTokens), int64(bucket.totalTokens), cost)
		modelKey := key.provider + "\x00" + key.model
		addToRow(byModelMap, modelKey, func(row *aiTokenRow) {
			row.Model = key.model
			row.Provider = key.provider
		}, int64(bucket.promptTokens), int64(bucket.completionTokens), int64(bucket.totalTokens), cost)
	}

	byProvider := mapToSortedRows(byProviderMap, func(row aiTokenRow) string { return row.Provider })
	byModel := mapToSortedRows(byModelMap, func(row aiTokenRow) string { return row.Provider + row.Model })

	var totalRow aiTokenRow
	totalRow.Provider = "total"
	for _, row := range byProvider {
		totalRow.CompletionTokens += row.CompletionTokens
		totalRow.PromptTokens += row.PromptTokens
		totalRow.TotalTokens += row.TotalTokens
		if row.Cost != nil {
			if totalRow.Cost == nil {
				totalRow.Cost = &aiCost{Currency: row.Cost.Currency}
			}
			totalRow.Cost.Input += row.Cost.Input
			totalRow.Cost.Output += row.Cost.Output
			totalRow.Cost.Total += row.Cost.Total
		}
	}
	if len(byProvider) > 0 {
		byProvider = append(byProvider, totalRow)
	}

	type seriesKey struct{ model, provider string }
	seriesBuckets := map[seriesKey]map[time.Time]*bucketAccum{}
	for key, bucket := range rangeBuckets {
		if key.ts.IsZero() {
			continue
		}
		sk := seriesKey{model: key.model, provider: key.provider}
		if seriesBuckets[sk] == nil {
			seriesBuckets[sk] = map[time.Time]*bucketAccum{}
		}
		seriesBuckets[sk][key.ts] = bucket
	}

	sortedKeys := make([]seriesKey, 0, len(seriesBuckets))
	for key := range seriesBuckets {
		sortedKeys = append(sortedKeys, key)
	}
	sort.Slice(sortedKeys, func(i, j int) bool {
		if sortedKeys[i].provider != sortedKeys[j].provider {
			return sortedKeys[i].provider < sortedKeys[j].provider
		}
		return sortedKeys[i].model < sortedKeys[j].model
	})

	series := make([]aiTimeSeriesEntry, 0, len(sortedKeys))
	for _, sk := range sortedKeys {
		var pts []aiTimeSeriesPoint
		for ts, bucket := range seriesBuckets[sk] {
			pts = append(pts, aiTimeSeriesPoint{
				CompletionTokens: int64(bucket.completionTokens),
				Cost:             bucket.cost,
				PromptTokens:     int64(bucket.promptTokens),
				Timestamp:        ts,
				TotalTokens:      int64(bucket.totalTokens),
			})
		}
		sort.Slice(pts, func(i, j int) bool {
			return pts[i].Timestamp.Before(pts[j].Timestamp)
		})
		series = append(series, aiTimeSeriesEntry{
			Model:    sk.model,
			Points:   pts,
			Provider: sk.provider,
		})
	}

	return &aiUsageResponse{
		Summary: aiUsageSummary{
			ByModel:    byModel,
			ByProvider: byProvider,
		},
		TimeSeries: aiUsageTimeSeries{
			Series: series,
			Step:   strconv.Itoa(stepSecs),
			Window: string(interval),
		},
		TokenUnit: aiTokenUnitMillions,
	}
}

func getAILongTermUsageData(r *http.Request, conf *config.Config, windowStr, requestStr, username string, promClient prometheus.ClientInterface) (*aiUsageResponse, int, error) {
	fromStr := r.URL.Query().Get("from")
	sinceStr := r.URL.Query().Get("since")
	if sinceStr == "" {
		sinceStr = r.URL.Query().Get("to")
	}

	var fromTime, sinceTime time.Time
	if fromStr == "" || sinceStr == "" {
		// If they aren't provided, default to the requested window ending now
		now := time.Now()
		sinceTime = now

		switch windowStr {
		case "weekly":
			fromTime = now.AddDate(0, 0, -7*12) // Default to 12 weeks back
		case "monthly":
			fromTime = now.AddDate(0, -12, 0) // Default to 12 months back
		default:
			// It's a duration window (e.g. 2592000 = 30d)
			window, err := parseUsageDuration(windowStr)
			if err != nil {
				return nil, http.StatusBadRequest, fmt.Errorf("invalid window: %w", err)
			}
			fromTime = now.Add(-window)
		}
	} else {
		fromSec, err := strconv.ParseInt(fromStr, 10, 64)
		if err != nil {
			return nil, http.StatusBadRequest, fmt.Errorf("invalid from parameter")
		}
		sinceSec, err := strconv.ParseInt(sinceStr, 10, 64)
		if err != nil {
			return nil, http.StatusBadRequest, fmt.Errorf("invalid since parameter")
		}

		fromTime = time.Unix(fromSec, 0)
		sinceTime = time.Unix(sinceSec, 0)
	}

	if sinceTime.Before(fromTime) {
		return nil, http.StatusBadRequest, fmt.Errorf("since must be after from")
	}

	if promClient == nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("prometheus client not available")
	}

	api := promClient.API()
	duration := sinceTime.Sub(fromTime)
	durationSecs := int(duration.Seconds())
	if durationSecs <= 0 {
		durationSecs = 1
	}

	consumptionStr := r.URL.Query().Get("consumption")
	calculateCosts := consumptionStr == "true" && conf.AI.Metrics

	// Build summary and time series
	byProviderMap := map[string]*aiTokenRow{}
	byModelMap := map[string]*aiTokenRow{}

	type bucketKey struct {
		provider string
		model    string
		ts       time.Time
	}
	type bucketAccum struct {
		completionTokens float64
		promptTokens     float64
		totalTokens      float64
		cost             *aiCost
	}
	buckets := map[bucketKey]*bucketAccum{}
	providerBuckets := map[string]map[time.Time]*bucketAccum{}
	totalBuckets := map[time.Time]*bucketAccum{}

	type userModelKey struct {
		username string
		provider string
		model    string
	}
	type userModelAccum struct {
		promptTokens     float64
		completionTokens float64
		totalTokens      float64
	}
	userModelMap := map[userModelKey]*userModelAccum{}

	selector := ""
	if username != "" {
		selector = fmt.Sprintf(`{username=%q}`, username)
	}

	queryMetric := func(metricName string) model.Vector {
		var query string
		if windowStr == "weekly" || windowStr == "monthly" {
			query = fmt.Sprintf("max_over_time(%s%s[%ds])", metricName, selector, durationSecs)
		} else {
			query = fmt.Sprintf("increase(%s%s[%ds])", metricName, selector, durationSecs)
		}

		result, warnings, err := api.Query(r.Context(), query, sinceTime)
		if len(warnings) > 0 {
			log.Warningf("handleLongTermChatUsage: warnings querying %s: %v", metricName, warnings)
		}
		if err != nil {
			log.Errorf("handleLongTermChatUsage: failed to query prometheus for %s: %v", metricName, err)
			return nil
		}
		vec, ok := result.(model.Vector)
		if !ok {
			return nil
		}
		return vec
	}

	metricTotal := "kiali_ai_tokens_weekly_total"
	metricPrompt := "kiali_ai_prompt_tokens_weekly_total"
	metricCompletion := "kiali_ai_completion_tokens_weekly_total"
	if windowStr == "monthly" {
		metricTotal = "kiali_ai_tokens_monthly_total"
		metricPrompt = "kiali_ai_prompt_tokens_monthly_total"
		metricCompletion = "kiali_ai_completion_tokens_monthly_total"
	} else if windowStr != "weekly" {
		// It's a duration window (e.g. 2592000 = 30d)
		metricTotal = "kiali_ai_total_tokens_total"
		metricPrompt = "kiali_ai_prompt_tokens_total"
		metricCompletion = "kiali_ai_completion_tokens_total"
	}

	vecTotal := queryMetric(metricTotal)
	vecPrompt := queryMetric(metricPrompt)
	vecCompletion := queryMetric(metricCompletion)

	if vecTotal == nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to query prometheus")
	}

	processVec := func(vec model.Vector, field string) {
		for _, s := range vec {
			provider := string(s.Metric[model.LabelName("ai_provider")])
			aiModel := string(s.Metric[model.LabelName("ai_model")])
			req := string(s.Metric[model.LabelName("request")])
			yearStr := string(s.Metric[model.LabelName("year")])

			if req != requestStr {
				continue
			}
			if username != "" && string(s.Metric[model.LabelName("username")]) != username {
				continue
			}

			var ts time.Time
			switch windowStr {
			case "weekly":
				weekStr := string(s.Metric[model.LabelName("week")])
				year, _ := strconv.Atoi(yearStr)
				week, _ := strconv.Atoi(weekStr)
				ts = isoWeekToTime(year, week)
			case "monthly":
				monthStr := string(s.Metric[model.LabelName("month")])
				year, _ := strconv.Atoi(yearStr)
				month, _ := strconv.Atoi(monthStr)
				ts = time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
			default:
				// For duration queries (e.g. 30d), we don't add to the time series here
				// We only use this for the summary totals
				ts = time.Time{}
			}

			if !ts.IsZero() {
				if ts.Before(fromTime) || !ts.Before(sinceTime) {
					continue
				}
			}

			val := float64(s.Value)
			if val <= 0 {
				continue
			}

			sampleUser := string(s.Metric[model.LabelName("username")])
			if sampleUser == "" {
				sampleUser = "unknown"
			}

			umKey := userModelKey{username: sampleUser, provider: provider, model: aiModel}
			if userModelMap[umKey] == nil {
				userModelMap[umKey] = &userModelAccum{}
			}
			switch field {
			case "total":
				userModelMap[umKey].totalTokens += val
			case "prompt":
				userModelMap[umKey].promptTokens += val
			case "completion":
				userModelMap[umKey].completionTokens += val
			}

			bk := bucketKey{provider: provider, model: aiModel, ts: ts}
			if buckets[bk] == nil {
				buckets[bk] = &bucketAccum{}
			}
			if ts.IsZero() {
				// We only care about the summary totals for duration queries
				switch field {
				case "total":
					buckets[bk].totalTokens += val
				case "prompt":
					buckets[bk].promptTokens += val
				case "completion":
					buckets[bk].completionTokens += val
				}
				continue
			}
			if providerBuckets[provider] == nil {
				providerBuckets[provider] = map[time.Time]*bucketAccum{}
			}
			if providerBuckets[provider][ts] == nil {
				providerBuckets[provider][ts] = &bucketAccum{}
			}
			if totalBuckets[ts] == nil {
				totalBuckets[ts] = &bucketAccum{}
			}

			switch field {
			case "total":
				buckets[bk].totalTokens += val
				providerBuckets[provider][ts].totalTokens += val
				totalBuckets[ts].totalTokens += val
			case "prompt":
				buckets[bk].promptTokens += val
				providerBuckets[provider][ts].promptTokens += val
				totalBuckets[ts].promptTokens += val
			case "completion":
				buckets[bk].completionTokens += val
				providerBuckets[provider][ts].completionTokens += val
				totalBuckets[ts].completionTokens += val
			}
		}
	}

	processVec(vecTotal, "total")
	processVec(vecPrompt, "prompt")
	processVec(vecCompletion, "completion")

	// Calculate costs for buckets
	if calculateCosts {
		for bk, b := range buckets {
			cost := calculateCost(conf, bk.provider, bk.model, int64(b.promptTokens), int64(b.completionTokens))
			if cost != nil {
				b.cost = cost

				if !bk.ts.IsZero() {
					if providerBuckets[bk.provider][bk.ts].cost == nil {
						providerBuckets[bk.provider][bk.ts].cost = &aiCost{Currency: cost.Currency}
					}
					providerBuckets[bk.provider][bk.ts].cost.Input += cost.Input
					providerBuckets[bk.provider][bk.ts].cost.Output += cost.Output
					providerBuckets[bk.provider][bk.ts].cost.Total += cost.Total

					if totalBuckets[bk.ts].cost == nil {
						totalBuckets[bk.ts].cost = &aiCost{Currency: cost.Currency}
					}
					totalBuckets[bk.ts].cost.Input += cost.Input
					totalBuckets[bk.ts].cost.Output += cost.Output
					totalBuckets[bk.ts].cost.Total += cost.Total
				}
			}
		}
	}

	for bk, b := range buckets {
		cost := calculateCost(conf, bk.provider, bk.model, int64(b.promptTokens), int64(b.completionTokens))

		addToRow(byProviderMap, bk.provider, func(row *aiTokenRow) {
			row.Provider = bk.provider
		}, int64(b.promptTokens), int64(b.completionTokens), int64(b.totalTokens), cost)

		modelKey := bk.provider + "\x00" + bk.model
		addToRow(byModelMap, modelKey, func(row *aiTokenRow) {
			row.Model = bk.model
			row.Provider = bk.provider
		}, int64(b.promptTokens), int64(b.completionTokens), int64(b.totalTokens), cost)
	}

	byProvider := mapToSortedRows(byProviderMap, func(r aiTokenRow) string { return r.Provider })
	byModel := mapToSortedRows(byModelMap, func(r aiTokenRow) string { return r.Provider + r.Model })

	// Build sparse points
	bucketsToPoints := func(b map[time.Time]*bucketAccum) []aiTimeSeriesPoint {
		var pts []aiTimeSeriesPoint
		for ts, val := range b {
			pts = append(pts, aiTimeSeriesPoint{
				Timestamp:        ts,
				CompletionTokens: int64(val.completionTokens),
				PromptTokens:     int64(val.promptTokens),
				TotalTokens:      int64(val.totalTokens),
				Cost:             val.cost,
			})
		}
		sort.Slice(pts, func(i, j int) bool {
			return pts[i].Timestamp.Before(pts[j].Timestamp)
		})
		return pts
	}

	// If it's a duration query, we also need to get the time series data
	// by querying Prometheus range API
	if windowStr != "weekly" && windowStr != "monthly" {
		step, _ := parseUsageDuration(r.URL.Query().Get("step"))
		if step <= 0 {
			step = time.Hour
		}
		stepSeconds := int64(step / time.Second)

		rangeParams := prom_v1.Range{
			Start: fromTime,
			End:   sinceTime,
			Step:  step,
		}

		queryRangeMetric := func(metricName string) model.Matrix {
			query := fmt.Sprintf("increase(%s%s[%ds])", metricName, selector, stepSeconds)
			result, warnings, err := api.QueryRange(r.Context(), query, rangeParams)
			if len(warnings) > 0 {
				log.Warningf("handleLongTermChatUsage: warnings querying %s range: %v", metricName, warnings)
			}
			if err != nil {
				log.Errorf("handleLongTermChatUsage: failed to query prometheus for %s range: %v", metricName, err)
				return nil
			}
			mat, ok := result.(model.Matrix)
			if !ok {
				return nil
			}
			return mat
		}

		matTotal := queryRangeMetric(metricTotal)
		matPrompt := queryRangeMetric(metricPrompt)
		matCompletion := queryRangeMetric(metricCompletion)

		processMat := func(mat model.Matrix, field string) {
			if mat == nil {
				return
			}
			for _, s := range mat {
				provider := string(s.Metric[model.LabelName("ai_provider")])
				aiModel := string(s.Metric[model.LabelName("ai_model")])
				req := string(s.Metric[model.LabelName("request")])

				if req != requestStr {
					continue
				}
				if username != "" && string(s.Metric[model.LabelName("username")]) != username {
					continue
				}

				for _, point := range s.Values {
					ts := point.Timestamp.Time()
					val := float64(point.Value)
					if val <= 0 {
						continue
					}

					// If the timestamp is exactly at the edge of the window, it might be a synthetic event
					// injected by the mock script. We want to include it in the time series.
					bk := bucketKey{provider: provider, model: aiModel, ts: ts}
					if buckets[bk] == nil {
						buckets[bk] = &bucketAccum{}
					}
					if providerBuckets[provider] == nil {
						providerBuckets[provider] = map[time.Time]*bucketAccum{}
					}
					if providerBuckets[provider][ts] == nil {
						providerBuckets[provider][ts] = &bucketAccum{}
					}
					if totalBuckets[ts] == nil {
						totalBuckets[ts] = &bucketAccum{}
					}

					switch field {
					case "total":
						buckets[bk].totalTokens += val
						providerBuckets[provider][ts].totalTokens += val
						totalBuckets[ts].totalTokens += val
					case "prompt":
						buckets[bk].promptTokens += val
						providerBuckets[provider][ts].promptTokens += val
						totalBuckets[ts].promptTokens += val
					case "completion":
						buckets[bk].completionTokens += val
						providerBuckets[provider][ts].completionTokens += val
						totalBuckets[ts].completionTokens += val
					}
				}
			}
		}

		// Clear the buckets map before processing range data, as we only want time-series points here
		// The summary totals were already calculated from the instant query
		buckets = map[bucketKey]*bucketAccum{}
		providerBuckets = map[string]map[time.Time]*bucketAccum{}
		totalBuckets = map[time.Time]*bucketAccum{}

		processMat(matTotal, "total")
		processMat(matPrompt, "prompt")
		processMat(matCompletion, "completion")

		// Recalculate costs for the time series buckets
		if calculateCosts {
			for bk, b := range buckets {
				cost := calculateCost(conf, bk.provider, bk.model, int64(b.promptTokens), int64(b.completionTokens))
				if cost != nil {
					b.cost = cost

					if providerBuckets[bk.provider][bk.ts].cost == nil {
						providerBuckets[bk.provider][bk.ts].cost = &aiCost{Currency: cost.Currency}
					}
					providerBuckets[bk.provider][bk.ts].cost.Input += cost.Input
					providerBuckets[bk.provider][bk.ts].cost.Output += cost.Output
					providerBuckets[bk.provider][bk.ts].cost.Total += cost.Total

					if totalBuckets[bk.ts].cost == nil {
						totalBuckets[bk.ts].cost = &aiCost{Currency: cost.Currency}
					}
					totalBuckets[bk.ts].cost.Input += cost.Input
					totalBuckets[bk.ts].cost.Output += cost.Output
					totalBuckets[bk.ts].cost.Total += cost.Total
				}
			}
		}
	}

	// We need to build the seriesBuckets from the buckets map
	// This was missing for the non-weekly/monthly queries
	type seriesKey struct{ provider, model string }
	seriesBuckets := map[seriesKey]map[time.Time]*bucketAccum{}
	for bk, val := range buckets {
		if bk.ts.IsZero() {
			continue
		}
		sk := seriesKey{provider: bk.provider, model: bk.model}
		if seriesBuckets[sk] == nil {
			seriesBuckets[sk] = map[time.Time]*bucketAccum{}
		}
		seriesBuckets[sk][bk.ts] = val
	}

	for i := range byProvider {
		if bk, ok := providerBuckets[byProvider[i].Provider]; ok {
			byProvider[i].TimeSeries = bucketsToPoints(bk)
		}
	}

	var totalRow aiTokenRow
	totalRow.Provider = "total"
	for _, r := range byProvider {
		totalRow.CompletionTokens += r.CompletionTokens
		totalRow.PromptTokens += r.PromptTokens
		totalRow.TotalTokens += r.TotalTokens
		if r.Cost != nil {
			if totalRow.Cost == nil {
				totalRow.Cost = &aiCost{Currency: r.Cost.Currency}
			}
			totalRow.Cost.Input += r.Cost.Input
			totalRow.Cost.Output += r.Cost.Output
			totalRow.Cost.Total += r.Cost.Total
		}
	}
	totalRow.TimeSeries = bucketsToPoints(totalBuckets)
	byProvider = append(byProvider, totalRow)

	// Build series
	sortedKeys := make([]seriesKey, 0, len(seriesBuckets))
	for k := range seriesBuckets {
		sortedKeys = append(sortedKeys, k)
	}
	sort.Slice(sortedKeys, func(i, j int) bool {
		if sortedKeys[i].provider != sortedKeys[j].provider {
			return sortedKeys[i].provider < sortedKeys[j].provider
		}
		return sortedKeys[i].model < sortedKeys[j].model
	})

	series := make([]aiTimeSeriesEntry, 0, len(sortedKeys))
	for _, sk := range sortedKeys {
		pts := bucketsToPoints(seriesBuckets[sk])
		series = append(series, aiTimeSeriesEntry{
			Model:    sk.model,
			Points:   pts,
			Provider: sk.provider,
		})
	}

	var topSummary *aiTopSummary
	if username == "" {
		limitStr := r.URL.Query().Get("limit")
		limit := 5
		if limitStr != "" {
			if val, err := strconv.Atoi(limitStr); err == nil && val > 0 {
				limit = val
			}
		}

		// Top models calculation
		topModels := make([]aiTopModelRow, 0, len(byModelMap))
		for _, row := range byModelMap {
			topModels = append(topModels, aiTopModelRow{
				Model:       row.Model,
				Provider:    row.Provider,
				TotalTokens: row.TotalTokens,
				Cost:        row.Cost,
			})
		}
		sort.Slice(topModels, func(i, j int) bool {
			if topModels[i].TotalTokens != topModels[j].TotalTokens {
				return topModels[i].TotalTokens > topModels[j].TotalTokens
			}
			if topModels[i].Provider != topModels[j].Provider {
				return topModels[i].Provider < topModels[j].Provider
			}
			return topModels[i].Model < topModels[j].Model
		})
		if len(topModels) > limit {
			topModels = topModels[:limit]
		}

		// Top users calculation with cost computed over each model
		type userAccum struct {
			totalTokens float64
			cost        *aiCost
		}
		userMap := map[string]*userAccum{}

		for umKey, accum := range userModelMap {
			var cost *aiCost
			if calculateCosts {
				cost = calculateCost(conf, umKey.provider, umKey.model, int64(accum.promptTokens), int64(accum.completionTokens))
			}

			if userMap[umKey.username] == nil {
				userMap[umKey.username] = &userAccum{}
			}

			userMap[umKey.username].totalTokens += accum.totalTokens
			if cost != nil {
				if userMap[umKey.username].cost == nil {
					userMap[umKey.username].cost = &aiCost{Currency: cost.Currency}
				}
				userMap[umKey.username].cost.Input += cost.Input
				userMap[umKey.username].cost.Output += cost.Output
				userMap[umKey.username].cost.Total += cost.Total
			}
		}

		topUsers := make([]aiTopUserRow, 0, len(userMap))
		for userName, accum := range userMap {
			topUsers = append(topUsers, aiTopUserRow{
				Username:    userName,
				TotalTokens: int64(accum.totalTokens),
				Cost:        accum.cost,
				Budget:      getBudgetStatusForUser(r.Context(), conf, userName, promClient),
			})
		}
		sort.Slice(topUsers, func(i, j int) bool {
			if topUsers[i].TotalTokens != topUsers[j].TotalTokens {
				return topUsers[i].TotalTokens > topUsers[j].TotalTokens
			}
			return topUsers[i].Username < topUsers[j].Username
		})
		if len(topUsers) > limit {
			topUsers = topUsers[:limit]
		}

		topSummary = &aiTopSummary{
			TopModels: topModels,
			TopUsers:  topUsers,
		}
	}

	return &aiUsageResponse{
		Summary: aiUsageSummary{
			ByModel:    byModel,
			ByProvider: byProvider,
		},
		TimeSeries: aiUsageTimeSeries{
			Series: series,
			Step:   windowStr,
			Window: windowStr,
		},
		TokenUnit:  "millions",
		TopSummary: topSummary,
	}, http.StatusOK, nil
}

func isoWeekToTime(year, week int) time.Time {
	t := time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC)
	for t.Weekday() != time.Thursday {
		t = t.AddDate(0, 0, 1)
	}
	t = t.AddDate(0, 0, -3)
	return t.AddDate(0, 0, (week-1)*7)
}
