package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/prometheus/common/model"

	"github.com/kiali/kiali/ai"
	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/ai/prompts"
	aiTypes "github.com/kiali/kiali/ai/types"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/handlers/authentication"
	"github.com/kiali/kiali/handlers/queryparams"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/perses"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/internalmetrics"
	"github.com/kiali/kiali/tracing"
)

func GetKialiInterface(
	r *http.Request,
	conf *config.Config,
	kialiCache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	cpm business.ControlPlaneMonitor,
	prom prometheus.ClientInterface,
	traceClientLoader func() tracing.ClientInterface,
	grafana *grafana.Service,
	perses *perses.Service,
	discovery *istio.Discovery,
) (*mcputil.KialiInterface, error) {
	businessLayer, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
	if err != nil {
		return nil, err
	}
	return &mcputil.KialiInterface{
		Request:       r,
		BusinessLayer: businessLayer,
		Prom:          prom,
		ClientFactory: clientFactory,
		KialiCache:    kialiCache,
		Conf:          conf,
		Graphana:      grafana,
		Perses:        perses,
		Discovery:     discovery,
	}, nil
}

func ChatMCP(
	conf *config.Config,
	kialiCache cache.KialiCache,
	aiStore aiTypes.AIStore,
	clientFactory kubernetes.ClientFactory,
	prom prometheus.ClientInterface,
	cpm business.ControlPlaneMonitor,
	traceClientLoader func() tracing.ClientInterface,
	grafana *grafana.Service,
	perses *perses.Service,
	discovery *istio.Discovery,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		params := mux.Vars(r)
		toolName := params["tool_name"]
		if err := mcp.LoadTools(); err != nil {
			RespondWithError(w, http.StatusInternalServerError, "AI initialization error: "+err.Error())
			return
		}
		var args map[string]interface{}
		if r.Body != nil && r.ContentLength != 0 {
			if err := json.NewDecoder(r.Body).Decode(&args); err != nil {
				http.Error(w, "Invalid request body", http.StatusBadRequest)
				return
			}
		}
		if args == nil {
			args = map[string]interface{}{}
		}
		handlers := mcp.MCPToolHandlers
		if _, ok := args["mcp_mode"]; !ok {
			args["mcp_mode"] = "true"
		}
		if r.Header.Get(mcp.HeaderKialiUI) != "" {
			args["mcp_mode"] = "false"
			handlers = mcp.DefaultToolHandlers
		}
		tool, ok := handlers[toolName]
		if !ok {
			RespondWithError(w, http.StatusNotFound, fmt.Sprintf("Tool '%s' not found", toolName))
			return
		}
		if !conf.ExternalServices.Tracing.Enabled && mcp.IsTraceTool(toolName) {
			RespondWithError(w, http.StatusNotFound, fmt.Sprintf("Tool '%s' is not available when tracing is disabled", toolName))
			return
		}
		// 404 mirrors the tracing gate convention above
		if !conf.ExternalServices.Prometheus.Enabled && mcp.IsMetricTool(toolName) {
			RespondWithError(w, http.StatusNotFound, "metrics are unavailable because Prometheus is disabled")
			return
		}
		// Gate Ambient-specific tools before building the full interface, matching the tracing/metrics pattern above.
		if mcp.IsAmbientTool(toolName) {
			if !kialiCache.IsAmbientEnabledInAnyCluster(accessibleClusterNames(clientFactory)) {
				RespondWithError(w, http.StatusNotFound,
					fmt.Sprintf("Tool '%s' is not available when Ambient Mesh is not enabled in any cluster", toolName))
				return
			}
		}
		kialiInterface, err := GetKialiInterface(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, perses, discovery)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "AI initialization error: "+err.Error())
			return
		}
		mcpResult, code := tool.Call(kialiInterface, args)
		if code != http.StatusOK {
			RespondWithError(w, code, fmt.Sprintf("Tool %s returned error: %v", toolName, mcpResult))
			return
		}
		RespondWithJSON(w, code, mcpResult)
	}
}

// accessibleClusterNames returns cluster names reachable via the client factory's service-account clients.
func accessibleClusterNames(clientFactory kubernetes.ClientFactory) []string {
	saClients := clientFactory.GetSAClients()
	names := make([]string, 0, len(saClients))
	for clusterName := range saClients {
		names = append(names, clusterName)
	}
	return names
}

func ChatPrompts(conf *config.Config, kialiCache cache.KialiCache, clientFactory kubernetes.ClientFactory) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !conf.AI.Enabled && !conf.AI.ChatAI.Enabled {
			RespondWithError(w, http.StatusServiceUnavailable, "ChatAI is not enabled")
			return
		}

		ambientEnabled := kialiCache.IsAmbientEnabledInAnyCluster(accessibleClusterNames(clientFactory))

		query := r.URL.Query()
		if err := queryparams.RejectUnknown(query, "category"); err != nil {
			RespondWithQueryParamError(w, err.Error())
			return
		}
		category := query.Get("category")
		catalog := prompts.Catalog()
		filtered := make([]prompts.Prompt, 0, len(catalog))
		for _, p := range catalog {
			if p.IsAmbient && !ambientEnabled {
				continue
			}
			if category != "" && p.Category != category {
				continue
			}
			filtered = append(filtered, p)
		}
		RespondWithJSON(w, http.StatusOK, filtered)
	}
}

func ChatAI(
	conf *config.Config,
	kialiCache cache.KialiCache,
	aiStore aiTypes.AIStore,
	clientFactory kubernetes.ClientFactory,
	prom prometheus.ClientInterface,
	cpm business.ControlPlaneMonitor,
	traceClientLoader func() tracing.ClientInterface,
	grafana *grafana.Service,
	perses *perses.Service,
	discovery *istio.Discovery,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		params := mux.Vars(r)
		providerName := params["provider"]
		modelName := params["model"]

		if !conf.AI.Enabled && !conf.AI.ChatAI.Enabled {
			RespondWithError(w, http.StatusInternalServerError, "ChatAI is not enabled")
			return
		}
		var req aiTypes.AIRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			RespondWithError(w, http.StatusBadRequest, "Invalid request body")
			return
		}
		fallbackUserID := ""
		if conf.Auth.Strategy != config.AuthStrategyAnonymous {
			authInfo, err := getAuthInfo(r)
			if err != nil {
				RespondWithError(w, http.StatusInternalServerError, "AI initialization error: "+err.Error())
				return
			}
			clusterAuth, ok := authInfo[conf.KubernetesConfig.ClusterName]
			if !ok || clusterAuth == nil {
				RespondWithError(w, http.StatusInternalServerError, fmt.Sprintf("AI initialization error: auth info not found for cluster %q", conf.KubernetesConfig.ClusterName))
				return
			}
			fallbackUserID = clusterAuth.Username
		} else {
			fallbackUserID = "anonymous"
		}

		if len(conf.AI.ChatAI.AllowedUsers) > 0 && !slices.Contains(conf.AI.ChatAI.AllowedUsers, fallbackUserID) {
			RespondWithError(w, http.StatusForbidden, "You are not allowed to use the ChatAI feature")
			return
		}

		username := resolveChatAIUsername(r, conf, fallbackUserID)
		sessionID := resolveChatAISessionID(r, conf, username)

		if conf.AI.Metrics {
			budget := conf.AI.Consumption.GetBudgetForUser(username)
			if budget != nil {
				// 1. Check if provider is allowed
				if len(budget.AllowedProviders) > 0 {
					allowed := false
					for _, ap := range budget.AllowedProviders {
						var providerType config.ProviderType
						for _, cp := range conf.AI.ChatAI.Providers {
							if cp.Name == providerName {
								providerType = cp.Type
								break
							}
						}
						if providerType == ap {
							allowed = true
							break
						}
					}
					if !allowed {
						RespondWithError(w, http.StatusForbidden, fmt.Sprintf("Provider %q is not allowed by your budget configuration", providerName))
						return
					}
				}

				// 2. Check if model is allowed
				if len(budget.AllowedModels) > 0 {
					allowed := false
					for _, am := range budget.AllowedModels {
						if config.MatchModelPattern(am, modelName) {
							allowed = true
							break
						}
						// Also check resolved model ID under the provider
						for _, cp := range conf.AI.ChatAI.Providers {
							if cp.Name == providerName {
								for _, cm := range cp.Models {
									if cm.Name == modelName && config.MatchModelPattern(am, cm.Model) {
										allowed = true
										break
									}
								}
							}
						}
					}
					if !allowed {
						RespondWithError(w, http.StatusForbidden, fmt.Sprintf("Model %q is not allowed by your budget configuration", modelName))
						return
					}
				}

				// 3. Check if budget is reached
				if reached, reason := CheckBudgetReached(r.Context(), conf, username, prom); reached {
					RespondWithError(w, http.StatusForbidden, fmt.Sprintf("AI request blocked: %s", reason))
					return
				}
			}
		}

		provider, err := ai.NewAIProvider(conf, providerName, modelName)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "AI initialization error: "+err.Error())
			return
		}
		usageProviderName := providerName
		usageModelName := modelName
		if usageMetadata, err := ai.ResolveUsageMetadata(conf, providerName, modelName); err == nil && usageMetadata != nil {
			if usageMetadata.Provider != "" {
				usageProviderName = usageMetadata.Provider
			}
			if usageMetadata.Model != "" {
				usageModelName = usageMetadata.Model
			}
		}

		requestTimer := internalmetrics.GetAIRequestDurationPrometheusTimer(providerName, modelName)
		defer requestTimer.ObserveDuration()
		kialiInterface, err := GetKialiInterface(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, perses, discovery)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "AI initialization error: "+err.Error())
			return
		}
		internalmetrics.GetAIRequestsTotalMetric(providerName, modelName).Inc()
		// Add headers to prevent any buffering along the way
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache, no-transform")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("X-Accel-Buffering", "no")
		// Disable gzip for this specific endpoint to ensure real-time streaming
		w.Header().Set("Content-Encoding", "identity")
		flusher, ok := w.(http.Flusher)
		if !ok {
			RespondWithError(w, http.StatusInternalServerError, "Streaming unsupported")
			return
		}

		// Explicitly send the headers right now so proxies stop buffering
		w.WriteHeader(http.StatusOK)
		flusher.Flush()

		// Also try to flush using ResponseController if available
		rc := http.NewResponseController(w)
		_ = rc.Flush()

		if unwrapper, ok := w.(interface{ Unwrap() http.ResponseWriter }); ok {
			if f, ok := unwrapper.Unwrap().(http.Flusher); ok {
				f.Flush()
			}
		}

		onChunk := func(chunk string) {
			fmt.Fprintf(w, "data: %s\n\n", chunk)
			flusher.Flush()

			// Try to flush ResponseController if available
			rc := http.NewResponseController(w)
			_ = rc.Flush()

			// Try to unwrap and flush if it's a wrapped writer
			if unwrapper, ok := w.(interface{ Unwrap() http.ResponseWriter }); ok {
				if f, ok := unwrapper.Unwrap().(http.Flusher); ok {
					f.Flush()
				}
			}
		}
		usage := provider.SendChat(onChunk, r, req, kialiInterface, aiStore)
		recordChatAIUsage(conf, aiStore, sessionID, username, usageProviderName, usageModelName, usage)
	}
}

// resolveChatAIUsername returns the durable user identity used for Prometheus
// token metrics and budget evaluation. It must not return a browser session ID.
func resolveChatAIUsername(r *http.Request, conf *config.Config, fallbackUserID string) string {
	if fallbackUserID != "" && fallbackUserID != AnonymousSessionID {
		return fallbackUserID
	}
	if conf != nil && conf.Auth.Strategy == config.AuthStrategyAnonymous {
		return "anonymous"
	}

	authInfo, err := getAuthInfo(r)
	if err != nil {
		if conf != nil && conf.Auth.Strategy == config.AuthStrategyAnonymous {
			return "anonymous"
		}
		return ""
	}
	clusterAuth, ok := authInfo[conf.KubernetesConfig.ClusterName]
	if !ok || clusterAuth == nil || clusterAuth.Username == "" {
		if conf != nil && conf.Auth.Strategy == config.AuthStrategyAnonymous {
			return "anonymous"
		}
		return ""
	}
	if clusterAuth.Username == AnonymousSessionID {
		return "anonymous"
	}
	return clusterAuth.Username
}

// resolveChatAISessionID returns the in-memory session key for chat transcripts
// and current-session usage. Anonymous users share AnonymousSessionID.
func resolveChatAISessionID(r *http.Request, conf *config.Config, fallbackUserID string) string {
	sessionID := authentication.GetSessionIDContext(r.Context())
	if sessionID != "" {
		return sessionID
	}
	return resolveChatAIUsername(r, conf, fallbackUserID)
}

func recordChatAIUsage(conf *config.Config, aiStore aiTypes.AIStore, sessionID string, username string, provider string, model string, usage aiTypes.TokenUsage) {
	if !usage.HasTokens() {
		return
	}
	if sessionID == "" {
		sessionID = "unknown"
	}
	if username == "" {
		username = sessionID
	}
	if aiStore != nil && aiStore.Enabled() {
		if err := aiStore.RecordUsage(sessionID, provider, model, usage); err != nil {
			log.Errorf("[Chat AI] Failed to record usage for user [%s], provider [%s], model [%s]: %v", username, provider, model, err)
		}
	}
	if conf.AI.Metrics {
		internalmetrics.RecordAITokens(username, provider, model, usage.PromptTokens, usage.CompletionTokens, usage.TotalTokens)
	}
}

type UserBudgetStatus struct {
	HasBudget       bool                  `json:"has_budget"`
	Interval        config.BudgetInterval `json:"interval,omitempty"`
	MaxCost         float64               `json:"max_cost"`
	MaxTokens       float64               `json:"max_tokens"`
	RemainingCost   float64               `json:"remaining_cost"`
	RemainingTokens float64               `json:"remaining_tokens"`
}

func GetBudgetUsedForUser(ctx context.Context, conf *config.Config, userID string, budget *config.UserBudgetConfig, promClient prometheus.ClientInterface) (float64, int64) {
	if budget == nil {
		return 0, 0
	}

	now := time.Now()
	weekly := budget.Interval == config.WeeklyBudget

	var metricPrompt, metricCompletion, metricTotal string
	var queryLabels string

	if weekly {
		year, week := now.ISOWeek()
		metricPrompt = "kiali_ai_prompt_tokens_weekly_total"
		metricCompletion = "kiali_ai_completion_tokens_weekly_total"
		metricTotal = "kiali_ai_tokens_weekly_total"
		queryLabels = fmt.Sprintf("username=%q,request=\"chat\",year=%q,week=%q", userID, strconv.Itoa(year), strconv.Itoa(week))
	} else if budget.Interval == config.MonthlyBudget {
		metricPrompt = "kiali_ai_prompt_tokens_monthly_total"
		metricCompletion = "kiali_ai_completion_tokens_monthly_total"
		metricTotal = "kiali_ai_tokens_monthly_total"
		queryLabels = fmt.Sprintf("username=%q,request=\"chat\",year=%q,month=%q", userID, strconv.Itoa(now.Year()), strconv.Itoa(int(now.Month())))
	} else {
		return 0, 0
	}

	promptMap := map[string]float64{}
	completionMap := map[string]float64{}
	totalMap := map[string]float64{}

	if promClient != nil {
		api := promClient.API()
		queryGroup := func(metricName string) map[string]float64 {
			// last_over_time is required because remote-written weekly/monthly buckets
			// often have timestamps older than Prometheus's 5m instant-query staleness window.
			query := fmt.Sprintf("sum by (ai_provider, ai_model) (last_over_time(%s{%s}[35d]))", metricName, queryLabels)
			res, _, err := api.Query(ctx, query, now)
			if err != nil {
				log.Errorf("GetBudgetUsedForUser: failed to query prometheus: %v", err)
				return nil
			}
			vec, ok := res.(model.Vector)
			if !ok {
				return nil
			}
			m := make(map[string]float64)
			for _, s := range vec {
				provider := string(s.Metric[model.LabelName("ai_provider")])
				modelID := string(s.Metric[model.LabelName("ai_model")])
				key := provider + "\x00" + modelID
				m[key] = float64(s.Value)
			}
			return m
		}
		promptMap = queryGroup(metricPrompt)
		completionMap = queryGroup(metricCompletion)
		totalMap = queryGroup(metricTotal)
		if promptMap == nil {
			promptMap = map[string]float64{}
		}
		if completionMap == nil {
			completionMap = map[string]float64{}
		}
		if totalMap == nil {
			totalMap = map[string]float64{}
		}
	}

	// In-process counters update on each chat; take the max so budget does not wait on scrape.
	for _, row := range internalmetrics.GetCurrentPeriodUsage(userID, weekly) {
		key := row.Provider + "\x00" + row.Model
		if float64(row.PromptTokens) > promptMap[key] {
			promptMap[key] = float64(row.PromptTokens)
		}
		if float64(row.CompletionTokens) > completionMap[key] {
			completionMap[key] = float64(row.CompletionTokens)
		}
		if float64(row.TotalTokens) > totalMap[key] {
			totalMap[key] = float64(row.TotalTokens)
		}
	}

	var totalTokens int64
	var totalCost float64

	for _, val := range totalMap {
		totalTokens += int64(val)
	}

	for key, promptVal := range promptMap {
		parts := strings.Split(key, "\x00")
		if len(parts) != 2 {
			continue
		}
		provider := parts[0]
		modelID := parts[1]
		completionVal := completionMap[key]

		cost := calculateCost(conf, provider, modelID, int64(promptVal), int64(completionVal))
		if cost != nil {
			totalCost += cost.Total
		}
	}

	return totalCost, totalTokens
}

func getBudgetStatusForUser(ctx context.Context, conf *config.Config, userID string, promClient prometheus.ClientInterface) *UserBudgetStatus {
	if !conf.AI.Metrics {
		return nil
	}
	budget := conf.AI.Consumption.GetBudgetForUser(userID)
	if budget != nil {
		usedCost, usedTokens := GetBudgetUsedForUser(ctx, conf, userID, budget, promClient)

		remainingCost := 0.0
		if budget.MaxCost > 0 {
			remainingCost = budget.MaxCost - usedCost
			if remainingCost < 0 {
				remainingCost = 0
			}
		}

		remainingTokens := 0.0
		if budget.MaxTokens > 0 {
			remainingTokens = budget.MaxTokens - tokensToMillions(usedTokens)
			if remainingTokens < 0 {
				remainingTokens = 0
			}
		}

		return &UserBudgetStatus{
			HasBudget:       true,
			Interval:        budget.Interval,
			MaxCost:         budget.MaxCost,
			MaxTokens:       budget.MaxTokens,
			RemainingCost:   remainingCost,
			RemainingTokens: remainingTokens,
		}
	}
	return &UserBudgetStatus{
		HasBudget: false,
	}
}

func CheckBudgetReached(ctx context.Context, conf *config.Config, userID string, promClient prometheus.ClientInterface) (bool, string) {
	if !conf.AI.Enabled || !conf.AI.Metrics {
		return false, ""
	}
	budget := conf.AI.Consumption.GetBudgetForUser(userID)
	if budget == nil {
		return false, ""
	}

	usedCost, usedTokens := GetBudgetUsedForUser(ctx, conf, userID, budget, promClient)

	if budget.MaxCost > 0 && usedCost >= budget.MaxCost {
		return true, fmt.Sprintf("monetary budget reached (limit: %.2f, used: %.2f)", budget.MaxCost, usedCost)
	}
	rawMaxTokens := int64(budget.MaxTokens * 1_000_000.0)
	if rawMaxTokens > 0 && usedTokens >= rawMaxTokens {
		return true, fmt.Sprintf("token budget reached (limit: %d, used: %d)", rawMaxTokens, usedTokens)
	}

	return false, ""
}

type chatSessionUsageResponse struct {
	Budget        *UserBudgetStatus     `json:"budget,omitempty"`
	CurrentPeriod *aiUsageResponse      `json:"currentPeriod,omitempty"`
	Metrics       *aiUsageResponse      `json:"metrics,omitempty"`
	Session       []aiTypes.UsageMetric `json:"session"`
}

const currentWeekStepSecs = 3600

func fetchUserLongTermUsage(
	r *http.Request,
	conf *config.Config,
	username string,
	windowStr string,
	from, since time.Time,
	stepSecs int,
	promClient prometheus.ClientInterface,
) *aiUsageResponse {
	q := r.URL.Query()
	q.Set("from", strconv.FormatInt(from.Unix(), 10))
	q.Set("since", strconv.FormatInt(since.Unix(), 10))
	q.Set("consumption", "true")
	if stepSecs > 0 {
		q.Set("step", strconv.Itoa(stepSecs))
	} else {
		q.Del("step")
	}

	cloned := r.Clone(r.Context())
	cloned.URL.RawQuery = q.Encode()

	data, _, err := getAILongTermUsageData(cloned, conf, windowStr, "chat", username, promClient)
	if err != nil {
		log.Warningf("AIUserUsage: failed to get usage data for user %s window %s: %v", username, windowStr, err)
		return nil
	}
	return data
}

// mergeLiveCurrentWeekEvents overlays in-memory chat events onto the Prometheus
// hourly series so the current-week chart updates as soon as a request is recorded,
// without waiting for the next scrape.
func mergeLiveCurrentWeekEvents(
	conf *config.Config,
	data *aiUsageResponse,
	username string,
	weekFrom, now time.Time,
	stepSecs int,
) *aiUsageResponse {
	if username == "" {
		return data
	}
	if stepSecs <= 0 {
		stepSecs = currentWeekStepSecs
	}
	step := time.Duration(stepSecs) * time.Second
	weekFrom = weekFrom.UTC()

	type seriesKey struct {
		model    string
		provider string
	}
	type hourKey struct {
		hour     time.Time
		model    string
		provider string
	}

	hours := map[hourKey]*aiTimeSeriesPoint{}
	for _, ev := range internalmetrics.GetAITokenEvents(weekFrom) {
		if ev.Request != "chat" || ev.Username != username {
			continue
		}
		hour := ev.Timestamp.UTC().Truncate(step)
		if hour.Before(weekFrom) || hour.After(now.UTC()) {
			continue
		}
		hk := hourKey{hour: hour, model: ev.Model, provider: ev.Provider}
		if hours[hk] == nil {
			hours[hk] = &aiTimeSeriesPoint{Timestamp: hour}
		}
		hours[hk].CompletionTokens += ev.CompletionTokens
		hours[hk].PromptTokens += ev.PromptTokens
		hours[hk].TotalTokens += ev.TotalTokens
	}
	if len(hours) == 0 {
		return data
	}

	if data == nil {
		data = &aiUsageResponse{
			TimeSeries: aiUsageTimeSeries{
				Step:   strconv.Itoa(stepSecs),
				Window: string(config.WeeklyBudget),
			},
			TokenUnit: aiTokenUnitMillions,
		}
	}

	index := map[seriesKey]int{}
	for i, series := range data.TimeSeries.Series {
		index[seriesKey{model: series.Model, provider: series.Provider}] = i
	}

	for hk, live := range hours {
		live.Cost = calculateCost(conf, hk.provider, hk.model, live.PromptTokens, live.CompletionTokens)
		sk := seriesKey{model: hk.model, provider: hk.provider}
		i, ok := index[sk]
		if !ok {
			data.TimeSeries.Series = append(data.TimeSeries.Series, aiTimeSeriesEntry{
				Model:    hk.model,
				Points:   []aiTimeSeriesPoint{*live},
				Provider: hk.provider,
			})
			index[sk] = len(data.TimeSeries.Series) - 1
			continue
		}

		points := data.TimeSeries.Series[i].Points
		replaced := false
		for j := range points {
			if points[j].Timestamp.UTC().Truncate(step).Equal(hk.hour) {
				if live.TotalTokens > points[j].TotalTokens {
					points[j] = *live
				}
				replaced = true
				break
			}
		}
		if !replaced {
			points = append(points, *live)
			sort.Slice(points, func(a, b int) bool {
				return points[a].Timestamp.Before(points[b].Timestamp)
			})
		}
		data.TimeSeries.Series[i].Points = points
	}

	return data
}

// alignCurrentPeriodToUsed makes the hourly period series total match the budget
// weekly/monthly counter. The budget query is the source of truth for used.
func alignCurrentPeriodToUsed(data *aiUsageResponse, usedTokens int64, usedCost float64, weekFrom time.Time) *aiUsageResponse {
	if usedTokens <= 0 && usedCost <= 0 {
		return data
	}

	var sumTokens int64
	var sumCost float64
	if data != nil {
		for _, series := range data.TimeSeries.Series {
			for _, point := range series.Points {
				sumTokens += point.TotalTokens
				if point.Cost != nil {
					sumCost += point.Cost.Total
				}
			}
		}
	}

	if usedTokens > 0 && sumTokens > usedTokens {
		tokenScale := float64(usedTokens) / float64(sumTokens)
		costScale := 1.0
		if usedCost >= 0 && sumCost > usedCost && sumCost > 0 {
			costScale = usedCost / sumCost
		}
		for i := range data.TimeSeries.Series {
			for j := range data.TimeSeries.Series[i].Points {
				point := &data.TimeSeries.Series[i].Points[j]
				point.CompletionTokens = int64(float64(point.CompletionTokens) * tokenScale)
				point.PromptTokens = int64(float64(point.PromptTokens) * tokenScale)
				point.TotalTokens = int64(float64(point.TotalTokens) * tokenScale)
				if point.Cost != nil && costScale != 1 {
					point.Cost.Input *= costScale
					point.Cost.Output *= costScale
					point.Cost.Total *= costScale
				}
			}
		}
		return data
	}

	deltaTokens := usedTokens - sumTokens
	deltaCost := usedCost - sumCost
	if deltaTokens <= 0 && deltaCost <= 0 {
		return data
	}

	if data == nil {
		data = &aiUsageResponse{
			TimeSeries: aiUsageTimeSeries{
				Step:   strconv.Itoa(currentWeekStepSecs),
				Window: string(config.WeeklyBudget),
			},
			TokenUnit: aiTokenUnitMillions,
		}
	}

	point := aiTimeSeriesPoint{
		Timestamp:   weekFrom.UTC(),
		TotalTokens: max(deltaTokens, 0),
	}
	if deltaCost > 0 {
		point.Cost = &aiCost{Currency: "USD", Total: deltaCost}
	}

	if len(data.TimeSeries.Series) == 0 {
		data.TimeSeries.Series = []aiTimeSeriesEntry{{
			Points:   []aiTimeSeriesPoint{point},
			Provider: "total",
		}}
		return data
	}

	data.TimeSeries.Series[0].Points = append([]aiTimeSeriesPoint{point}, data.TimeSeries.Series[0].Points...)
	sort.Slice(data.TimeSeries.Series[0].Points, func(i, j int) bool {
		return data.TimeSeries.Series[0].Points[i].Timestamp.Before(data.TimeSeries.Series[0].Points[j].Timestamp)
	})
	return data
}

func AIUserUsage(
	conf *config.Config,
	aiStore aiTypes.AIStore,
	promClient prometheus.ClientInterface,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !conf.AI.Enabled && !conf.AI.ChatAI.Enabled {
			RespondWithError(w, http.StatusInternalServerError, "ChatAI is not enabled")
			return
		}

		username := resolveChatAIUsername(r, conf, "")
		sessionID := resolveChatAISessionID(r, conf, username)
		if username == "" && sessionID == "" {
			RespondWithError(w, http.StatusBadRequest, "Unable to determine session usage scope")
			return
		}

		budgetStatus := getBudgetStatusForUser(r.Context(), conf, username, promClient)

		session := []aiTypes.UsageMetric{}
		if aiStore != nil {
			session = aiStore.GetUsageMetrics(sessionID)
		}

		var metrics *aiUsageResponse
		var currentPeriod *aiUsageResponse
		if conf.AI.Metrics && promClient != nil {
			window := config.WeeklyBudget
			if budgetStatus != nil && (budgetStatus.Interval == config.WeeklyBudget || budgetStatus.Interval == config.MonthlyBudget) {
				window = budgetStatus.Interval
			}

			n := defaultUserUsageBuckets
			if nStr := r.URL.Query().Get("n"); nStr != "" {
				if parsed, err := strconv.Atoi(nStr); err == nil && parsed > 0 {
					n = parsed
				}
			}

			now := time.Now()
			from, since := lastNBucketRange(window, n, now)
			q := r.URL.Query()
			if q.Get("from") != "" && (q.Get("since") != "" || q.Get("to") != "") {
				if parsed, err := strconv.ParseInt(q.Get("from"), 10, 64); err == nil {
					from = time.Unix(parsed, 0)
				}
				endStr := q.Get("since")
				if endStr == "" {
					endStr = q.Get("to")
				}
				if parsed, err := strconv.ParseInt(endStr, 10, 64); err == nil {
					since = time.Unix(parsed, 0)
				}
			}

			metrics = fetchUserLongTermUsage(r, conf, username, string(window), from, since, 0, promClient)

			periodFrom, periodSince := lastNBucketRange(window, 1, now)
			currentPeriod = fetchCurrentPeriodHourly(r, conf, username, window, periodFrom, periodSince, currentWeekStepSecs, promClient)
			currentPeriod = mergeLiveCurrentWeekEvents(conf, currentPeriod, username, periodFrom, now, currentWeekStepSecs)
			if budgetStatus != nil && budgetStatus.HasBudget {
				usedTokens := int64((budgetStatus.MaxTokens-budgetStatus.RemainingTokens)*tokensPerMillion + 0.5)
				usedCost := budgetStatus.MaxCost - budgetStatus.RemainingCost
				currentPeriod = alignCurrentPeriodToUsed(currentPeriod, usedTokens, usedCost, periodFrom)
			}
			if currentPeriod != nil {
				currentPeriod.TimeSeries.Window = string(window)
				currentPeriod.TimeSeries.Step = strconv.Itoa(currentWeekStepSecs)
			}
		}

		RespondWithJSON(w, http.StatusOK, chatSessionUsageResponse{
			Budget:        budgetStatus,
			CurrentPeriod: currentPeriod,
			Metrics:       metrics,
			Session:       session,
		})
	}
}

// ---- ChatUsage response types -----------------------------------------------
//
// Token counts are stored and aggregated as raw integers (Prometheus counters and
// in-memory events). The API exposes them in millions of tokens because provider
// pricing is quoted per million tokens.

const (
	aiTokenUnitMillions = "millions"
	tokensPerMillion    = 1_000_000.0
)

func tokensToMillions(tokens int64) float64 {
	return float64(tokens) / tokensPerMillion
}

type aiUsageResponse struct {
	Summary    aiUsageSummary    `json:"summary"`
	TimeSeries aiUsageTimeSeries `json:"timeSeries"`
	TokenUnit  string            `json:"tokenUnit"`
	TopSummary *aiTopSummary     `json:"topSummary,omitempty"`
}

func (r aiUsageResponse) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Summary    aiUsageSummary    `json:"summary"`
		TimeSeries aiUsageTimeSeries `json:"timeSeries"`
		TokenUnit  string            `json:"tokenUnit"`
		TopSummary *aiTopSummary     `json:"topSummary,omitempty"`
	}{
		Summary:    r.Summary,
		TimeSeries: r.TimeSeries,
		TokenUnit:  aiTokenUnitMillions,
		TopSummary: r.TopSummary,
	})
}

type aiUsageSummary struct {
	ByModel    []aiTokenRow `json:"byModel"`
	ByProvider []aiTokenRow `json:"byProvider"`
}

type aiTopSummary struct {
	TopModels []aiTopModelRow `json:"topModels"`
	TopUsers  []aiTopUserRow  `json:"topUsers"`
}

type aiTopModelRow struct {
	Model       string  `json:"model"`
	Provider    string  `json:"provider"`
	TotalTokens int64   `json:"-"`
	Cost        *aiCost `json:"cost,omitempty"`
}

func (r aiTopModelRow) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Model       string  `json:"model"`
		Provider    string  `json:"provider"`
		TotalTokens float64 `json:"totalTokens"`
		Cost        *aiCost `json:"cost,omitempty"`
	}{
		Model:       r.Model,
		Provider:    r.Provider,
		TotalTokens: tokensToMillions(r.TotalTokens),
		Cost:        roundCost(r.Cost),
	})
}

type aiTopUserRow struct {
	Username    string            `json:"username"`
	TotalTokens int64             `json:"-"`
	Cost        *aiCost           `json:"cost,omitempty"`
	Budget      *UserBudgetStatus `json:"budget,omitempty"`
}

func (r aiTopUserRow) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Username    string            `json:"username"`
		TotalTokens float64           `json:"totalTokens"`
		Cost        *aiCost           `json:"cost,omitempty"`
		Budget      *UserBudgetStatus `json:"budget,omitempty"`
	}{
		Username:    r.Username,
		TotalTokens: tokensToMillions(r.TotalTokens),
		Cost:        roundCost(r.Cost),
		Budget:      r.Budget,
	})
}

type aiCost struct {
	Input    float64 `json:"input"`
	Output   float64 `json:"output"`
	Total    float64 `json:"total"`
	Currency string  `json:"currency,omitempty"`
}

func roundCost(c *aiCost) *aiCost {
	if c == nil {
		return nil
	}
	return &aiCost{
		Input:    float64(int64(c.Input*1_000_000.0+0.5)) / 1_000_000.0,
		Output:   float64(int64(c.Output*1_000_000.0+0.5)) / 1_000_000.0,
		Total:    float64(int64(c.Total*1_000_000.0+0.5)) / 1_000_000.0,
		Currency: c.Currency,
	}
}

// aiTokenRow is one row in an aggregated token table.
// Fields that do not apply to a given aggregation level are omitted from JSON.
// Token count fields are stored as raw tokens internally and serialized in millions.
type aiTokenRow struct {
	CompletionTokens int64  `json:"-"`
	Model            string `json:"model,omitempty"`
	PromptTokens     int64  `json:"-"`
	Provider         string `json:"provider,omitempty"`
	// TimeSeries is only populated for byProvider rows (including the synthetic
	// "total" row). It holds bucketed points suitable for rendering a sparkline.
	TimeSeries  []aiTimeSeriesPoint `json:"timeSeries,omitempty"`
	TotalTokens int64               `json:"-"`
	Cost        *aiCost             `json:"cost,omitempty"`
}

func (r aiTokenRow) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		CompletionTokens float64             `json:"completionTokens"`
		Model            string              `json:"model,omitempty"`
		PromptTokens     float64             `json:"promptTokens"`
		Provider         string              `json:"provider,omitempty"`
		TimeSeries       []aiTimeSeriesPoint `json:"timeSeries,omitempty"`
		TotalTokens      float64             `json:"totalTokens"`
		Cost             *aiCost             `json:"cost,omitempty"`
	}{
		CompletionTokens: tokensToMillions(r.CompletionTokens),
		Model:            r.Model,
		PromptTokens:     tokensToMillions(r.PromptTokens),
		Provider:         r.Provider,
		TimeSeries:       r.TimeSeries,
		TotalTokens:      tokensToMillions(r.TotalTokens),
		Cost:             roundCost(r.Cost),
	})
}

type aiUsageTimeSeries struct {
	Series []aiTimeSeriesEntry `json:"series"`
	Step   string              `json:"step"`
	Window string              `json:"window"`
}

type aiTimeSeriesEntry struct {
	Model    string              `json:"model"`
	Points   []aiTimeSeriesPoint `json:"points"`
	Provider string              `json:"provider"`
}

type aiTimeSeriesPoint struct {
	CompletionTokens int64     `json:"-"`
	PromptTokens     int64     `json:"-"`
	Timestamp        time.Time `json:"timestamp"`
	TotalTokens      int64     `json:"-"`
	Cost             *aiCost   `json:"cost,omitempty"`
}

func (p aiTimeSeriesPoint) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		CompletionTokens float64   `json:"completionTokens"`
		PromptTokens     float64   `json:"promptTokens"`
		Timestamp        time.Time `json:"timestamp"`
		TotalTokens      float64   `json:"totalTokens"`
		Cost             *aiCost   `json:"cost,omitempty"`
	}{
		CompletionTokens: tokensToMillions(p.CompletionTokens),
		PromptTokens:     tokensToMillions(p.PromptTokens),
		Timestamp:        p.Timestamp,
		TotalTokens:      tokensToMillions(p.TotalTokens),
		Cost:             roundCost(p.Cost),
	})
}

// ---- AIUsage handler ------------------------------------------------------

// AIUsage returns AI token consumption statistics derived from the Prometheus
// in-memory counters.  It provides:
//
//   - summary.byProvider  – total tokens aggregated per provider
//   - summary.byModel     – total tokens aggregated per (provider, model)
//   - summary.byUser      – total tokens aggregated per username
//   - timeSeries          – per-(provider, model) token counts bucketed in time
//
// Query parameters:
//
//	window  look-back window in seconds (default 86400 = 24 h; e.g. 3600=1h, 21600=6h, 604800=7d)
//	step    time-series bucket width in seconds (default 3600 = 1 h; e.g. 300=5m, 900=15m)
func AIUsage(conf *config.Config, _ aiTypes.AIStore, prom prometheus.ClientInterface) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !conf.AI.Enabled || !conf.AI.ChatAI.Enabled {
			RespondWithError(w, http.StatusServiceUnavailable, "ChatAI is not enabled")
			return
		}
		if !conf.AI.Enabled || !conf.AI.Metrics {
			RespondWithError(w, http.StatusServiceUnavailable, "ChatAI metrics are not enabled")
			return
		}

		windowStr := r.URL.Query().Get("window")
		if windowStr == "" {
			windowStr = "86400" // 24 h
		}
		stepStr := r.URL.Query().Get("step")
		if stepStr == "" {
			stepStr = "3600" // 1 h
		}

		requestStr := r.URL.Query().Get("request")
		if requestStr == "" {
			requestStr = "chat"
		}

		if windowStr == "weekly" || windowStr == "monthly" {
			// If consumption=true is passed, we can calculate costs
			// (already handled inside handleLongTermChatUsage by checking conf.AI.Metrics)
			handleLongTermChatUsage(w, r, conf, windowStr, requestStr, prom)
			return
		}

		window, err := parseUsageDuration(windowStr)
		if err != nil {
			RespondWithError(w, http.StatusBadRequest, "invalid window: "+err.Error())
			return
		}

		// If the requested window is greater than 24 hours, query Prometheus directly
		if window > 24*time.Hour {
			handleLongTermChatUsage(w, r, conf, windowStr, requestStr, prom)
			return
		}

		step, err := parseUsageDuration(stepStr)
		if err != nil {
			RespondWithError(w, http.StatusBadRequest, "invalid step: "+err.Error())
			return
		}
		if step <= 0 || step > window {
			RespondWithError(w, http.StatusBadRequest, "step must be positive and not greater than window")
			return
		}

		// Block until the Prometheus seeding goroutine has finished so the first
		// response always contains the full historical dataset. The wait is
		// bounded to avoid holding the connection open indefinitely when
		// Prometheus is slow or unreachable.
		internalmetrics.WaitForAITokensSeedingComplete(r.Context(), 30*time.Second)

		// Load events once for the requested window.
		// Both the summary aggregations and the time series are derived from the
		// same slice so that summary totals always match the sum of time series
		// points for the same window.
		now := time.Now()
		since := now.Add(-window)
		events := internalmetrics.GetAITokenEvents(since)

		consumptionStr := r.URL.Query().Get("consumption")
		calculateCosts := consumptionStr == "true" && conf.AI.Metrics

		// Filter events by request type
		var filteredEvents []internalmetrics.AITokenEvent
		for _, ev := range events {
			if ev.Request == requestStr {
				filteredEvents = append(filteredEvents, ev)
			}
		}
		events = filteredEvents

		// --- summary aggregations (window-scoped) ---------------------------------
		byProviderMap := map[string]*aiTokenRow{}
		byModelMap := map[string]*aiTokenRow{}

		for _, ev := range events {
			var cost *aiCost
			if calculateCosts {
				cost = calculateCost(conf, ev.Provider, ev.Model, ev.PromptTokens, ev.CompletionTokens)
			}

			addToRow(byProviderMap, ev.Provider, func(row *aiTokenRow) {
				row.Provider = ev.Provider
			}, ev.PromptTokens, ev.CompletionTokens, ev.TotalTokens, cost)

			modelKey := ev.Provider + "\x00" + ev.Model
			addToRow(byModelMap, modelKey, func(row *aiTokenRow) {
				row.Model = ev.Model
				row.Provider = ev.Provider
			}, ev.PromptTokens, ev.CompletionTokens, ev.TotalTokens, cost)
		}

		byProvider := mapToSortedRows(byProviderMap, func(r aiTokenRow) string { return r.Provider })
		byModel := mapToSortedRows(byModelMap, func(r aiTokenRow) string { return r.Provider + r.Model })

		// --- time-series ---------------------------------------------------------

		numBuckets := int(window/step) + 1

		type seriesKey struct{ provider, model string }
		type bucketAccum struct {
			completionTokens int64
			promptTokens     int64
			totalTokens      int64
			cost             *aiCost
		}

		seriesBuckets := map[seriesKey][]bucketAccum{}  // per (provider, model)
		providerBuckets := map[string][]bucketAccum{}   // per provider — for sparklines
		totalBuckets := make([]bucketAccum, numBuckets) // grand total — for the total sparkline

		for _, ev := range events {
			idx := int(ev.Timestamp.Sub(since) / step)
			if idx < 0 {
				idx = 0
			}
			if idx >= numBuckets {
				idx = numBuckets - 1
			}

			// (provider, model) buckets — existing line-chart data.
			sk := seriesKey{provider: ev.Provider, model: ev.Model}
			if _, ok := seriesBuckets[sk]; !ok {
				seriesBuckets[sk] = make([]bucketAccum, numBuckets)
			}
			b := &seriesBuckets[sk][idx]
			b.completionTokens += ev.CompletionTokens
			b.promptTokens += ev.PromptTokens
			b.totalTokens += ev.TotalTokens

			cost := calculateCost(conf, ev.Provider, ev.Model, ev.PromptTokens, ev.CompletionTokens)
			if calculateCosts && cost != nil {
				if b.cost == nil {
					b.cost = &aiCost{Currency: cost.Currency}
				}
				b.cost.Input += cost.Input
				b.cost.Output += cost.Output
				b.cost.Total += cost.Total
			}

			// Provider-level buckets for sparklines.
			if _, ok := providerBuckets[ev.Provider]; !ok {
				providerBuckets[ev.Provider] = make([]bucketAccum, numBuckets)
			}
			pb := &providerBuckets[ev.Provider][idx]
			pb.completionTokens += ev.CompletionTokens
			pb.promptTokens += ev.PromptTokens
			pb.totalTokens += ev.TotalTokens
			if calculateCosts && cost != nil {
				if pb.cost == nil {
					pb.cost = &aiCost{Currency: cost.Currency}
				}
				pb.cost.Input += cost.Input
				pb.cost.Output += cost.Output
				pb.cost.Total += cost.Total
			}

			// Grand-total buckets.
			totalBuckets[idx].completionTokens += ev.CompletionTokens
			totalBuckets[idx].promptTokens += ev.PromptTokens
			totalBuckets[idx].totalTokens += ev.TotalTokens
			if calculateCosts && cost != nil {
				if totalBuckets[idx].cost == nil {
					totalBuckets[idx].cost = &aiCost{Currency: cost.Currency}
				}
				totalBuckets[idx].cost.Input += cost.Input
				totalBuckets[idx].cost.Output += cost.Output
				totalBuckets[idx].cost.Total += cost.Total
			}
		}

		// bucketsToPoints converts a bucket slice to a sparse point list (zeros skipped).
		bucketsToPoints := func(buckets []bucketAccum) []aiTimeSeriesPoint {
			var pts []aiTimeSeriesPoint
			for i, bk := range buckets {
				if bk.totalTokens == 0 {
					continue
				}
				pts = append(pts, aiTimeSeriesPoint{
					CompletionTokens: bk.completionTokens,
					PromptTokens:     bk.promptTokens,
					Timestamp:        since.Add(time.Duration(i) * step),
					TotalTokens:      bk.totalTokens,
					Cost:             bk.cost,
				})
			}
			return pts
		}

		// Attach per-provider sparkline time series to each byProvider row.
		for i := range byProvider {
			if bk, ok := providerBuckets[byProvider[i].Provider]; ok {
				byProvider[i].TimeSeries = bucketsToPoints(bk)
			}
		}

		// Append the synthetic "total" row that aggregates across all providers.
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

		// Sort series keys for deterministic output.
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
			if len(pts) == 0 {
				continue // skip series with no activity in this window
			}
			series = append(series, aiTimeSeriesEntry{
				Model:    sk.model,
				Points:   pts,
				Provider: sk.provider,
			})
		}

		RespondWithJSON(w, http.StatusOK, aiUsageResponse{
			Summary: aiUsageSummary{
				ByModel:    byModel,
				ByProvider: byProvider,
			},
			TimeSeries: aiUsageTimeSeries{
				Series: series,
				Step:   stepStr,
				Window: windowStr,
			},
			TokenUnit: "millions",
		})
	}
}

// parseUsageDuration parses a plain integer string as a number of seconds.
// e.g. "60" → 1 minute, "3600" → 1 hour, "86400" → 1 day.
func parseUsageDuration(s string) (time.Duration, error) {
	secs, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("expected an integer number of seconds, got %q: %w", s, err)
	}
	if secs <= 0 {
		return 0, fmt.Errorf("duration must be a positive number of seconds, got %d", secs)
	}
	return time.Duration(secs) * time.Second, nil
}

// addToRow upserts a row in the map, applying initFn on first insert, then adds token counts.
func addToRow(m map[string]*aiTokenRow, key string, initFn func(*aiTokenRow), prompt, completion, total int64, cost *aiCost) {
	row, ok := m[key]
	if !ok {
		row = &aiTokenRow{}
		initFn(row)
		m[key] = row
	}
	row.CompletionTokens += completion
	row.PromptTokens += prompt
	row.TotalTokens += total
	if cost != nil {
		if row.Cost == nil {
			row.Cost = &aiCost{Currency: cost.Currency}
		}
		row.Cost.Input += cost.Input
		row.Cost.Output += cost.Output
		row.Cost.Total += cost.Total
	}
}

func calculateCost(conf *config.Config, provider, model string, promptTokens, completionTokens int64) *aiCost {
	if !conf.AI.Metrics {
		return nil
	}

	for _, pricing := range conf.AI.Consumption.ModelPricings {
		if string(pricing.Provider) == provider && pricing.ModelID == model {
			inputCost := tokensToMillions(promptTokens) * pricing.Prices.InputCostPerMillion
			outputCost := tokensToMillions(completionTokens) * pricing.Prices.OutputCostPerMillion
			return &aiCost{
				Input:    inputCost,
				Output:   outputCost,
				Total:    inputCost + outputCost,
				Currency: pricing.Currency,
			}
		}
	}

	return nil
}

// mapToSortedRows converts a map of *aiTokenRow values into a sorted slice.
func mapToSortedRows(m map[string]*aiTokenRow, sortKey func(aiTokenRow) string) []aiTokenRow {
	rows := make([]aiTokenRow, 0, len(m))
	for _, r := range m {
		rows = append(rows, *r)
	}
	sort.Slice(rows, func(i, j int) bool {
		return sortKey(rows[i]) < sortKey(rows[j])
	})
	return rows
}
func DeleteConversations(conf *config.Config, aiStore aiTypes.AIStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if aiStore == nil || !aiStore.Enabled() {
			RespondWithJSON(w, http.StatusOK, map[string]string{"message": "AI store is not enabled"})
			return
		}

		query := r.URL.Query()
		if err := queryparams.RejectUnknown(query, "conversationIDs"); err != nil {
			RespondWithQueryParamError(w, err.Error())
			return
		}
		idsParam := query.Get("conversationIDs")
		if idsParam == "" {
			RespondWithQueryParamError(w, "Missing required query parameter: conversationIDs")
			return
		}

		var ids []string
		for _, id := range strings.Split(idsParam, ",") {
			trimmed := strings.TrimSpace(id)
			if trimmed != "" {
				ids = append(ids, trimmed)
			}
		}
		if len(ids) == 0 {
			RespondWithQueryParamError(w, "No valid conversation IDs provided")
			return
		}

		sessionID := authentication.GetSessionIDContext(r.Context())
		if err := aiStore.DeleteConversations(sessionID, ids); err != nil {
			RespondWithError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to delete conversations: %v", err))
			return
		}

		RespondWithJSON(w, http.StatusOK, map[string]string{"message": "Conversations deleted"})
	}
}
