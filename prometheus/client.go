package prometheus

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/api"
	prom_v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
	"k8s.io/apimachinery/pkg/api/errors"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util/httputil"
)

var invalidLabelCharRE = regexp.MustCompile(`[^a-zA-Z0-9_]`)

const queryLogFile = "/tmp/kiali-prometheus-queries.log"

// ClientCallRecord represents a recorded method call
type ClientCallRecord struct {
	Method string      `json:"method"`
	Input  interface{} `json:"input"`
	Output interface{} `json:"output"`
}

// ClientRecorder records method calls to files
type ClientRecorder struct {
	outputDir string
	mutex     sync.Mutex
}

// NewClientRecorder creates a new method recorder
func NewClientRecorder(outputDir string) *ClientRecorder {
	return &ClientRecorder{
		outputDir: outputDir,
	}
}

// writeToFile writes a method call record to the appropriate file
func (mr *ClientRecorder) writeToFile(methodName string, input interface{}, output interface{}) {
	if mr == nil || mr.outputDir == "" {
		return
	}

	mr.mutex.Lock()
	defer mr.mutex.Unlock()

	// Create output directory if it doesn't exist
	if err := os.MkdirAll(mr.outputDir, 0o755); err != nil {
		log.Errorf("Failed to create method recording directory %s: %v", mr.outputDir, err)
		return
	}

	// Create record
	record := ClientCallRecord{
		Method: methodName,
		Input:  input,
		Output: output,
	}

	// Write to method-specific file
	filename := filepath.Join(mr.outputDir, methodName+".log")
	file, err := os.OpenFile(filename, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		log.Errorf("Failed to open method recording file %s: %v", filename, err)
		return
	}
	defer file.Close()

	// Marshal to JSON and write
	jsonData, err := json.Marshal(record)
	if err != nil {
		log.Errorf("Failed to marshal method record: %v", err)
		return
	}

	// Write JSON line to file
	if _, err := file.Write(append(jsonData, '\n')); err != nil {
		log.Errorf("Failed to write to method recording file: %v", err)
	}
}

// QueryRecorder embeds prom_v1.API and records all Query calls to a file
type QueryRecorder struct {
	prom_v1.API
	filePath string
	mutex    sync.Mutex
}

// QueryLogEntry represents the structure of logged query data
type QueryLogEntry struct {
	Query     string          `json:"query"`
	Timestamp string          `json:"timestamp"`
	Result    json.RawMessage `json:"result"`
	Warnings  []string        `json:"warnings"`
}

// NewQueryRecorder creates a new QueryRecorder that wraps the provided API
func NewQueryRecorder(api prom_v1.API, filePath string) *QueryRecorder {
	return &QueryRecorder{
		API:      api,
		filePath: filePath,
	}
}

// Query implements the prom_v1.API Query method and logs the results
func (qr *QueryRecorder) Query(ctx context.Context, query string, ts time.Time, opts ...prom_v1.Option) (model.Value, prom_v1.Warnings, error) {
	// Call the underlying API Query method
	result, warnings, err := qr.API.Query(ctx, query, ts, opts...)

	// Only write to file if there's no error
	if err != nil {
		log.Errorf("Prometheus query error, will not write to file: %v, query: %s", err, query)
	} else {
		// Marshal result to JSON
		resultJSON, marshalErr := json.Marshal(result)
		if marshalErr != nil {
			log.Errorf("Failed to marshal prometheus result: %v", marshalErr)
		} else {
			// Create log entry for successful queries only
			entry := QueryLogEntry{
				Query:     query,
				Timestamp: ts.Format(time.RFC3339),
				Result:    resultJSON,
				Warnings:  warnings,
			}

			// Write to file
			qr.writeToFile(entry)
		}
	}

	return result, warnings, err
}

// writeToFile safely writes the query log entry to the file
func (qr *QueryRecorder) writeToFile(entry QueryLogEntry) {
	qr.mutex.Lock()
	defer qr.mutex.Unlock()

	// Open file for appending (create if it doesn't exist)
	file, err := os.OpenFile(qr.filePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		// Log error but don't fail the query
		log.Errorf("Failed to open query log file %s: %v", qr.filePath, err)
		return
	}
	defer file.Close()

	// Marshal to JSON and write
	jsonData, err := json.Marshal(entry)
	if err != nil {
		log.Errorf("Failed to marshal query log entry: %v", err)
		return
	}

	// Write JSON line to file
	if _, err := file.Write(append(jsonData, '\n')); err != nil {
		log.Errorf("Failed to write to query log file: %v", err)
	}
}

// QueryFileReader embeds prom_v1.API and reads queries from a log file
type QueryFileReader struct {
	prom_v1.API
	filePath string
	mutex    sync.RWMutex
}

// NewQueryFileReader creates a new QueryFileReader that reads from the provided file
func NewQueryFileReader(api prom_v1.API, filePath string) *QueryFileReader {
	return &QueryFileReader{
		API:      api,
		filePath: filePath,
	}
}

// Query implements the prom_v1.API Query method by reading from the log file
func (qfr *QueryFileReader) Query(_ context.Context, query string, _ time.Time, _ ...prom_v1.Option) (model.Value, prom_v1.Warnings, error) {
	// Try to find the query result in the log file
	result, warnings, _, found := qfr.readFromFile(query)
	if found {
		return result, warnings, nil
	}

	// If not found, return empty values
	return result, warnings, nil
}

// readFromFile reads the log file and searches for a matching query and timestamp
func (qfr *QueryFileReader) readFromFile(query string) (model.Value, prom_v1.Warnings, error, bool) {
	qfr.mutex.RLock()
	defer qfr.mutex.RUnlock()

	// Open file for reading
	file, err := os.Open(qfr.filePath)
	if err != nil {
		// If file doesn't exist or can't be opened, return not found
		return model.Vector{}, prom_v1.Warnings{}, nil, false
	}
	defer file.Close()

	// Create a scanner to read line by line
	scanner := json.NewDecoder(file)

	// Read each line and try to find a match
	for scanner.More() {
		var entry QueryLogEntry
		if err := scanner.Decode(&entry); err != nil {
			log.Errorf("unable to decode entry: %s", err)
			continue
		}

		if entry.Query == query {
			// Unmarshal the raw JSON back to model.Value
			// Try different model.Value types until one works
			var result model.Value

			// Try model.Vector first (most common)
			var vector model.Vector
			if err := json.Unmarshal(entry.Result, &vector); err == nil {
				result = vector
			} else {
				log.Errorf("Unsupported type %T: %s", entry.Result, err)
			}

			return result, entry.Warnings, nil, true
		}
	}

	// No match found
	return model.Vector{}, prom_v1.Warnings{}, nil, false
}

// OfflineClient implements ClientInterface by reading from recorded method call files
type OfflineClient struct {
	api       prom_v1.API
	dataDir   string
	mutex     sync.RWMutex
	buildInfo *prom_v1.BuildinfoResult
}

func (oc *OfflineClient) API() prom_v1.API {
	return oc.api
}

// NewOfflineClient creates a new OfflineClient that reads from recorded method files
func NewOfflineClient(dataDir string, buildInfo *config.OfflineManifest) *OfflineClient {
	// Create QueryFileReader for offline prometheus queries
	queryFileReader := NewQueryFileReader(nil, "/tmp/kiali-prometheus-queries.log")
	return &OfflineClient{
		api:       queryFileReader,
		dataDir:   dataDir,
		buildInfo: &buildInfo.PrometheusBuildInfo,
	}
}

// readMethodFile reads a method-specific log file and finds a matching input
func (oc *OfflineClient) readMethodFile(methodName string, inputToMatch interface{}) (interface{}, bool) {
	oc.mutex.RLock()
	defer oc.mutex.RUnlock()

	filename := filepath.Join(oc.dataDir, methodName+".log")
	file, err := os.Open(filename)
	if err != nil {
		log.Debugf("Failed to open method file %s: %v", filename, err)
		return nil, false
	}
	defer file.Close()

	scanner := json.NewDecoder(file)
	for scanner.More() {
		var record ClientCallRecord
		if err := scanner.Decode(&record); err != nil {
			log.Errorf("Failed to decode method record: %v", err)
			continue
		}

		if record.Method == methodName {
			// Convert both inputs to JSON for comparison (ignoring queryTime)
			recordInputJSON, _ := json.Marshal(record.Input)
			matchInputJSON, _ := json.Marshal(inputToMatch)

			// Simple string comparison for now - could be made more sophisticated
			if string(recordInputJSON) == string(matchInputJSON) {
				return record.Output, true
			}
		}
	}

	return nil, false
}

// GetAllRequestRates implements ClientInterface
func (oc *OfflineClient) GetAllRequestRates(namespace, cluster, ratesInterval string, queryTime time.Time) (model.Vector, error) {
	input := map[string]interface{}{
		"namespace":     namespace,
		"cluster":       cluster,
		"ratesInterval": ratesInterval,
	}

	if output, found := oc.readMethodFile("GetAllRequestRates", input); found {
		if vector, ok := output.(model.Vector); ok {
			return vector, nil
		}
		// Try to convert from interface{} to model.Vector via JSON
		if jsonData, err := json.Marshal(output); err == nil {
			var vector model.Vector
			if err := json.Unmarshal(jsonData, &vector); err == nil {
				return vector, nil
			}
		}
	}

	return model.Vector{}, nil
}

// GetNamespaceServicesRequestRates implements ClientInterface
func (oc *OfflineClient) GetNamespaceServicesRequestRates(namespace, cluster, ratesInterval string, queryTime time.Time) (model.Vector, error) {
	input := map[string]interface{}{
		"namespace":     namespace,
		"cluster":       cluster,
		"ratesInterval": ratesInterval,
	}

	if output, found := oc.readMethodFile("GetNamespaceServicesRequestRates", input); found {
		if vector, ok := output.(model.Vector); ok {
			return vector, nil
		}
		if jsonData, err := json.Marshal(output); err == nil {
			var vector model.Vector
			if err := json.Unmarshal(jsonData, &vector); err == nil {
				return vector, nil
			}
		}
	}

	return model.Vector{}, nil
}

// GetServiceRequestRates implements ClientInterface
func (oc *OfflineClient) GetServiceRequestRates(namespace, cluster, service, ratesInterval string, queryTime time.Time) (model.Vector, error) {
	input := map[string]interface{}{
		"namespace":     namespace,
		"cluster":       cluster,
		"service":       service,
		"ratesInterval": ratesInterval,
	}

	if output, found := oc.readMethodFile("GetServiceRequestRates", input); found {
		if vector, ok := output.(model.Vector); ok {
			return vector, nil
		}
		if jsonData, err := json.Marshal(output); err == nil {
			var vector model.Vector
			if err := json.Unmarshal(jsonData, &vector); err == nil {
				return vector, nil
			}
		}
	}

	return model.Vector{}, nil
}

// GetAppRequestRates implements ClientInterface
func (oc *OfflineClient) GetAppRequestRates(namespace, cluster, app, ratesInterval string, queryTime time.Time) (model.Vector, model.Vector, error) {
	input := map[string]interface{}{
		"namespace":     namespace,
		"cluster":       cluster,
		"app":           app,
		"ratesInterval": ratesInterval,
	}

	if output, found := oc.readMethodFile("GetAppRequestRates", input); found {
		// The output should be a map with "inbound" and "outbound" keys
		if outputMap, ok := output.(map[string]interface{}); ok {
			var inbound, outbound model.Vector

			if inData, exists := outputMap["inbound"]; exists {
				if jsonData, err := json.Marshal(inData); err == nil {
					json.Unmarshal(jsonData, &inbound)
				}
			}

			if outData, exists := outputMap["outbound"]; exists {
				if jsonData, err := json.Marshal(outData); err == nil {
					json.Unmarshal(jsonData, &outbound)
				}
			}

			return inbound, outbound, nil
		}
	}

	return model.Vector{}, model.Vector{}, nil
}

// GetWorkloadRequestRates implements ClientInterface
func (oc *OfflineClient) GetWorkloadRequestRates(namespace, cluster, workload, ratesInterval string, queryTime time.Time) (model.Vector, model.Vector, error) {
	input := map[string]interface{}{
		"namespace":     namespace,
		"cluster":       cluster,
		"workload":      workload,
		"ratesInterval": ratesInterval,
	}

	if output, found := oc.readMethodFile("GetWorkloadRequestRates", input); found {
		if outputMap, ok := output.(map[string]interface{}); ok {
			var inbound, outbound model.Vector

			if inData, exists := outputMap["inbound"]; exists {
				if jsonData, err := json.Marshal(inData); err == nil {
					json.Unmarshal(jsonData, &inbound)
				}
			}

			if outData, exists := outputMap["outbound"]; exists {
				if jsonData, err := json.Marshal(outData); err == nil {
					json.Unmarshal(jsonData, &outbound)
				}
			}

			return inbound, outbound, nil
		}
	}

	return model.Vector{}, model.Vector{}, nil
}

// FetchDelta implements ClientInterface
func (oc *OfflineClient) FetchDelta(metricName, labels, grouping string, queryTime time.Time, duration time.Duration) Metric {
	// Return empty metric - this method is not recorded by ClientRecorder
	return Metric{}
}

// FetchHistogramRange implements ClientInterface
func (oc *OfflineClient) FetchHistogramRange(metricName, labels, grouping string, q *RangeQuery) Histogram {
	// Return empty histogram - this method is not recorded by ClientRecorder
	return Histogram{}
}

// FetchHistogramValues implements ClientInterface
func (oc *OfflineClient) FetchHistogramValues(metricName, labels, grouping, rateInterval string, avg bool, quantiles []string, queryTime time.Time) (map[string]model.Vector, error) {
	// Return empty map - this method is not recorded by ClientRecorder
	return map[string]model.Vector{}, nil
}

// FetchRange implements ClientInterface
func (oc *OfflineClient) FetchRange(metricName, labels, grouping, aggregator string, q *RangeQuery) Metric {
	// Return empty metric - this method is not recorded by ClientRecorder
	return Metric{}
}

// FetchRateRange implements ClientInterface
func (oc *OfflineClient) FetchRateRange(metricName string, labels []string, grouping string, q *RangeQuery) Metric {
	// Return empty metric - this method is not recorded by ClientRecorder
	return Metric{}
}

// GetConfiguration implements ClientInterface
func (oc *OfflineClient) GetConfiguration() (prom_v1.ConfigResult, error) {
	// Return empty config - this method is not recorded by ClientRecorder
	return prom_v1.ConfigResult{}, nil
}

// GetExistingMetricNames implements ClientInterface
func (oc *OfflineClient) GetExistingMetricNames(metricNames []string) ([]string, error) {
	// Return empty slice - this method is not recorded by ClientRecorder
	return []string{}, nil
}

// GetMetricsForLabels implements ClientInterface
func (oc *OfflineClient) GetMetricsForLabels(metricNames []string, labels string) ([]string, error) {
	// Return empty slice - this method is not recorded by ClientRecorder
	return []string{}, nil
}

// GetBuildInfo implements ClientInterface
func (oc *OfflineClient) GetBuildInfo(ctx context.Context) (*prom_v1.BuildinfoResult, error) {
	if oc.buildInfo == nil {
		return nil, fmt.Errorf("build info not available in offline mode")
	}

	return oc.buildInfo, nil
}

// GetRuntimeinfo implements ClientInterface
func (oc *OfflineClient) GetRuntimeinfo() (prom_v1.RuntimeinfoResult, error) {
	// Return empty runtime info - this method is not recorded by ClientRecorder
	return prom_v1.RuntimeinfoResult{}, nil
}

// ClientInterface for mocks (only mocked function are necessary here)
type ClientInterface interface {
	API() prom_v1.API
	FetchDelta(metricName, labels, grouping string, queryTime time.Time, duration time.Duration) Metric
	FetchHistogramRange(metricName, labels, grouping string, q *RangeQuery) Histogram
	FetchHistogramValues(metricName, labels, grouping, rateInterval string, avg bool, quantiles []string, queryTime time.Time) (map[string]model.Vector, error)
	FetchRange(metricName, labels, grouping, aggregator string, q *RangeQuery) Metric
	FetchRateRange(metricName string, labels []string, grouping string, q *RangeQuery) Metric
	GetAllRequestRates(namespace, cluster, ratesInterval string, queryTime time.Time) (model.Vector, error)
	GetAppRequestRates(namespace, cluster, app, ratesInterval string, queryTime time.Time) (model.Vector, model.Vector, error)
	GetBuildInfo(ctx context.Context) (*prom_v1.BuildinfoResult, error)
	GetConfiguration() (prom_v1.ConfigResult, error)
	GetExistingMetricNames(metricNames []string) ([]string, error)
	GetMetricsForLabels(metricNames []string, labels string) ([]string, error)
	GetNamespaceServicesRequestRates(namespace, cluster, ratesInterval string, queryTime time.Time) (model.Vector, error)
	GetServiceRequestRates(namespace, cluster, service, ratesInterval string, queryTime time.Time) (model.Vector, error)
	GetRuntimeinfo() (prom_v1.RuntimeinfoResult, error)
	GetWorkloadRequestRates(namespace, cluster, workload, ratesInterval string, queryTime time.Time) (model.Vector, model.Vector, error)
}

// Client for Prometheus API.
// It hides the way we query Prometheus offering a layer with a high level defined API.
type Client struct {
	ClientInterface
	p8s            api.Client
	api            prom_v1.API
	ctx            context.Context
	clientRecorder *ClientRecorder
}

var (
	once      sync.Once
	promCache PromCache
)

func initPromCache(ctx context.Context) {
	if config.Get().ExternalServices.Prometheus.CacheEnabled {
		log.FromContext(ctx).Info().Msgf("PromCache Enabled")
		promCache = NewPromCache(ctx)
	} else {
		log.FromContext(ctx).Info().Msgf("PromCache Disabled")
	}
}

// NewClient creates a new client to the Prometheus API.
// It returns an error on any problem.
func NewClient() (*Client, error) {
	return NewClientForConfig(*config.Get())
}

// NewClientForConfig creates a new client to the Prometheus API.
// It returns an error on any problem.
// If methodRecordingDir is provided, all method calls will be recorded to files in that directory.
func NewClientForConfig(conf config.Config, methodRecordingDir ...string) (*Client, error) {
	cfg := conf.ExternalServices.Prometheus
	clientConfig := api.Config{Address: cfg.URL}

	// Prom Cache will be initialized once at first use of Prometheus Client
	once.Do(func() {
		// create the cache with its own context/logger
		zl := log.WithGroup(log.PromCacheLogName)
		ctx := log.ToContext(context.Background(), zl)
		initPromCache(ctx)
	})

	// prepare the client logger and put it in a context
	zl := log.WithGroup(log.PrometheusLogName)
	ctx := log.ToContext(context.Background(), zl)

	// Be sure to copy config.Auth and not modify the existing
	auth := cfg.Auth
	if auth.UseKialiToken {
		// Note: if we are using the 'bearer' authentication method then we want to use the Kiali
		// service account token and not the user's token. This is because Kiali does filtering based
		// on the user's token and prevents people who shouldn't have access to particular metrics.
		token, _, err := kubernetes.GetKialiTokenForHomeCluster(config.Get())
		if err != nil {
			zl.Error().Msgf("Could not read the Kiali Service Account token: %v", err)
			return nil, err
		}
		auth.Token = token
	}

	// make a copy of the prometheus DefaultRoundTripper to avoid race condition (issue #3518)
	// Do not copy the struct itself, it contains a lock. Re-create it from scratch instead.
	roundTripper := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   30 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		TLSHandshakeTimeout: 10 * time.Second,
	}

	transportConfig, err := httputil.CreateTransport(&conf, &auth, roundTripper, httputil.DefaultTimeout, cfg.CustomHeaders)
	if err != nil {
		return nil, err
	}
	clientConfig.RoundTripper = transportConfig

	p8s, err := api.NewClient(clientConfig)
	if err != nil {
		return nil, errors.NewServiceUnavailable(err.Error())
	}

	api := prom_v1.NewAPI(p8s)
	if conf.RunMode == config.RunModeLocal {
		zl.Info().Msgf("Using QueryRecorder for local mode")
		api = NewQueryRecorder(api, queryLogFile)
	}

	// Create method recorder if directory is provided
	var methodRecorder *ClientRecorder
	if len(methodRecordingDir) > 0 && methodRecordingDir[0] != "" {
		methodRecorder = NewClientRecorder(methodRecordingDir[0])
	}

	client := Client{
		p8s:            p8s,
		api:            api,
		ctx:            ctx,
		clientRecorder: methodRecorder,
	}
	return &client, nil
}

// Inject allows for replacing the API with a mock For testing
func (in *Client) Inject(api prom_v1.API) {
	in.api = api
}

// GetAllRequestRates queries Prometheus to fetch request counter rates, over a time interval, for requests
// into, internal to, or out of the namespace. Note that it does not discriminate on "reporter", so rates can
// be inflated due to duplication, and therefore should be used mainly for calculating ratios
// (e.g total rates / error rates).
// Returns (rates, error)
func (in *Client) GetAllRequestRates(namespace, cluster string, ratesInterval string, queryTime time.Time) (model.Vector, error) {
	log.FromContext(in.ctx).Trace().Msgf("GetAllRequestRates [namespace: %s] [ratesInterval: %s] [queryTime: %s]", namespace, ratesInterval, queryTime.String())

	// Record method input
	input := map[string]interface{}{
		"namespace":     namespace,
		"cluster":       cluster,
		"ratesInterval": ratesInterval,
	}

	var result model.Vector
	var err error

	if promCache != nil {
		if isCached, cachedResult := promCache.GetAllRequestRates(namespace, cluster, ratesInterval, queryTime); isCached {
			result = cachedResult
		}
	}

	if result == nil {
		result, err = getAllRequestRates(in.ctx, in.api, namespace, cluster, queryTime, ratesInterval)
		if err == nil && promCache != nil {
			promCache.SetAllRequestRates(namespace, cluster, ratesInterval, queryTime, result)
		}
	}

	// Record method call
	if err == nil {
		in.clientRecorder.writeToFile("GetAllRequestRates", input, result)
	}

	return result, err
}

// GetNamespaceServicesRequestRates queries Prometheus to fetch request counter rates, over a time interval, limited to
// requests for services in the namespace. Note that it does not discriminate on "reporter", so rates can
// be inflated due to duplication, and therefore should be used mainly for calculating ratios
// (e.g total rates / error rates).
// Returns (rates, error)
func (in *Client) GetNamespaceServicesRequestRates(namespace, cluster string, ratesInterval string, queryTime time.Time) (model.Vector, error) {
	log.FromContext(in.ctx).Trace().Msgf("GetNamespaceServicesRequestRates [namespace: %s] [ratesInterval: %s] [queryTime: %s]", namespace, ratesInterval, queryTime.String())

	// Record method input
	input := map[string]interface{}{
		"namespace":     namespace,
		"cluster":       cluster,
		"ratesInterval": ratesInterval,
	}

	var result model.Vector
	var err error

	if promCache != nil {
		if isCached, cachedResult := promCache.GetNamespaceServicesRequestRates(namespace, cluster, ratesInterval, queryTime); isCached {
			result = cachedResult
		}
	}

	if result == nil {
		result, err = getNamespaceServicesRequestRates(in.ctx, in.api, namespace, cluster, queryTime, ratesInterval)
		if err == nil && promCache != nil {
			promCache.SetNamespaceServicesRequestRates(namespace, cluster, ratesInterval, queryTime, result)
		}
	}

	// Record method call
	if err == nil {
		in.clientRecorder.writeToFile("GetNamespaceServicesRequestRates", input, result)
	}

	return result, err
}

// GetServiceRequestRates queries Prometheus to fetch request counters rates over a time interval
// for a given service (hence only inbound). Note that it does not discriminate on "reporter", so rates can
// be inflated due to duplication, and therefore should be used mainly for calculating ratios
// (e.g total rates / error rates).
// Returns (in, error)
func (in *Client) GetServiceRequestRates(namespace, cluster, service, ratesInterval string, queryTime time.Time) (model.Vector, error) {
	log.FromContext(in.ctx).Trace().Msgf("GetServiceRequestRates [namespace: %s] [service: %s] [ratesInterval: %s] [queryTime: %s]", namespace, service, ratesInterval, queryTime.String())

	// Record method input
	input := map[string]interface{}{
		"namespace":     namespace,
		"cluster":       cluster,
		"service":       service,
		"ratesInterval": ratesInterval,
	}

	var result model.Vector
	var err error

	if promCache != nil {
		if isCached, cachedResult := promCache.GetServiceRequestRates(namespace, cluster, service, ratesInterval, queryTime); isCached {
			result = cachedResult
		}
	}

	if result == nil {
		result, err = getServiceRequestRates(in.ctx, in.api, namespace, cluster, service, queryTime, ratesInterval)
		if err == nil && promCache != nil {
			promCache.SetServiceRequestRates(namespace, cluster, service, ratesInterval, queryTime, result)
		}
	}

	// Record method call
	if err == nil {
		in.clientRecorder.writeToFile("GetServiceRequestRates", input, result)
	}

	return result, err
}

// GetAppRequestRates queries Prometheus to fetch request counters rates over a time interval
// for a given app, both in and out. Note that it does not discriminate on "reporter", so rates can
// be inflated due to duplication, and therefore should be used mainly for calculating ratios
// (e.g total rates / error rates).
// Returns (in, out, error)
func (in *Client) GetAppRequestRates(namespace, cluster, app, ratesInterval string, queryTime time.Time) (model.Vector, model.Vector, error) {
	log.FromContext(in.ctx).Trace().Msgf("GetAppRequestRates [namespace: %s] [cluster: %s] [app: %s] [ratesInterval: %s] [queryTime: %s]", namespace, cluster, app, ratesInterval, queryTime.String())

	// Record method input
	input := map[string]interface{}{
		"namespace":     namespace,
		"cluster":       cluster,
		"app":           app,
		"ratesInterval": ratesInterval,
	}

	var inResult, outResult model.Vector
	var err error

	if promCache != nil {
		if isCached, cachedIn, cachedOut := promCache.GetAppRequestRates(namespace, cluster, app, ratesInterval, queryTime); isCached {
			inResult, outResult = cachedIn, cachedOut
		}
	}

	if inResult == nil {
		inResult, outResult, err = getItemRequestRates(in.ctx, in.api, namespace, cluster, app, "app", queryTime, ratesInterval)
		if err == nil && promCache != nil {
			promCache.SetAppRequestRates(namespace, cluster, app, ratesInterval, queryTime, inResult, outResult)
		}
	}

	// Record method call
	if err == nil {
		output := map[string]interface{}{
			"inbound":  inResult,
			"outbound": outResult,
		}
		in.clientRecorder.writeToFile("GetAppRequestRates", input, output)
	}

	return inResult, outResult, err
}

// GetWorkloadRequestRates queries Prometheus to fetch request counters rates over a time interval
// for a given workload, both in and out. Note that it does not discriminate on "reporter", so rates can
// be inflated due to duplication, and therefore should be used mainly for calculating ratios
// (e.g total rates / error rates).
// Returns (in, out, error)
func (in *Client) GetWorkloadRequestRates(namespace, cluster, workload, ratesInterval string, queryTime time.Time) (model.Vector, model.Vector, error) {
	log.FromContext(in.ctx).Trace().Msgf("GetWorkloadRequestRates [namespace: %s] [workload: %s] [ratesInterval: %s] [queryTime: %s]", namespace, workload, ratesInterval, queryTime.String())

	// Record method input
	input := map[string]interface{}{
		"namespace":     namespace,
		"cluster":       cluster,
		"workload":      workload,
		"ratesInterval": ratesInterval,
	}

	var inResult, outResult model.Vector
	var err error

	if promCache != nil {
		if isCached, cachedIn, cachedOut := promCache.GetWorkloadRequestRates(namespace, cluster, workload, ratesInterval, queryTime); isCached {
			inResult, outResult = cachedIn, cachedOut
		}
	}

	if inResult == nil {
		inResult, outResult, err = getItemRequestRates(in.ctx, in.api, namespace, cluster, workload, "workload", queryTime, ratesInterval)
		if err == nil && promCache != nil {
			promCache.SetWorkloadRequestRates(namespace, cluster, workload, ratesInterval, queryTime, inResult, outResult)
		}
	}

	// Record method call
	if err == nil {
		output := map[string]interface{}{
			"inbound":  inResult,
			"outbound": outResult,
		}
		in.clientRecorder.writeToFile("GetWorkloadRequestRates", input, output)
	}

	return inResult, outResult, err
}

// FetchDelta fetches a delta for a simple metric (gauge or counter), for a given duration
func (in *Client) FetchDelta(metricName, labels, grouping string, queryTime time.Time, duration time.Duration) Metric {
	query := fmt.Sprintf("delta(%s%s[%s])", metricName, labels, duration.Round(time.Second).String())
	if grouping != "" {
		query += fmt.Sprintf(" by (%s)", grouping)
	}
	return fetchQuery(in.ctx, in.api, query, queryTime)
}

// FetchRange fetches a simple metric (gauge or counter) in given range
func (in *Client) FetchRange(metricName, labels, grouping, aggregator string, q *RangeQuery) Metric {
	query := fmt.Sprintf("%s(%s%s)", aggregator, metricName, labels)
	if grouping != "" {
		query += fmt.Sprintf(" by (%s)", grouping)
	}
	return fetchRange(in.ctx, in.api, query, q.Range)
}

// FetchRateRange fetches a counter's rate in given range
func (in *Client) FetchRateRange(metricName string, labels []string, grouping string, q *RangeQuery) Metric {
	return fetchRateRange(in.ctx, in.api, metricName, labels, grouping, q)
}

// FetchHistogramRange fetches bucketed metric as histogram in given range
func (in *Client) FetchHistogramRange(metricName, labels, grouping string, q *RangeQuery) Histogram {
	return fetchHistogramRange(in.ctx, in.api, metricName, labels, grouping, q)
}

// FetchHistogramValues fetches bucketed metric as histogram at a given specific time
func (in *Client) FetchHistogramValues(metricName, labels, grouping, rateInterval string, avg bool, quantiles []string, queryTime time.Time) (map[string]model.Vector, error) {
	return fetchHistogramValues(in.ctx, in.api, metricName, labels, grouping, rateInterval, avg, quantiles, queryTime)
}

// API returns the Prometheus V1 HTTP API for performing calls not supported natively by this client
func (in *Client) API() prom_v1.API {
	return in.api
}

func (in *Client) GetBuildInfo(ctx context.Context) (*prom_v1.BuildinfoResult, error) {
	info, err := in.api.Buildinfo(ctx)
	if err != nil {
		return nil, err
	}
	return &info, nil
}

func (in *Client) GetConfiguration() (prom_v1.ConfigResult, error) {
	config, err := in.API().Config(in.ctx)
	if err != nil {
		return prom_v1.ConfigResult{}, err
	}
	return config, nil
}

func (in *Client) GetRuntimeinfo() (prom_v1.RuntimeinfoResult, error) {
	ri, err := in.API().Runtimeinfo(in.ctx)
	if err != nil {
		return prom_v1.RuntimeinfoResult{}, err
	}
	return ri, nil
}

// GetMetricsForLabels returns a list of metrics existing for the provided labels set. Only metrics that match a name in the given
// list of metricNames will be returned - others will be ignored.
func (in *Client) GetMetricsForLabels(metricNames []string, labelQueryString string) ([]string, error) {
	if len(metricNames) == 0 {
		return []string{}, nil
	}

	zl := log.FromContext(in.ctx)

	zl.Trace().Msgf("GetMetricsForLabels: labels=[%v] metricNames=[%v]", labelQueryString, metricNames)
	startT := time.Now()
	queryString := fmt.Sprintf("count(%v) by (__name__)", labelQueryString)
	results, warnings, err := in.api.Query(in.ctx, queryString, time.Now())
	if len(warnings) > 0 {
		zl.Warn().Msgf("GetMetricsForLabels. Prometheus Warnings: [%s]", strings.Join(warnings, ","))
	}
	if err != nil {
		return nil, errors.NewServiceUnavailable(err.Error())
	}

	metricsWeAreLookingFor := make(map[string]bool, len(metricNames))
	for i := 0; i < len(metricNames); i++ {
		metricsWeAreLookingFor[metricNames[i]] = true
	}

	metricsWeFound := make([]string, 0, 5)
	for _, item := range results.(model.Vector) {
		n := string(item.Metric["__name__"])
		if metricsWeAreLookingFor[n] {
			metricsWeFound = append(metricsWeFound, n)
		}
	}

	zl.Trace().Msgf("GetMetricsForLabels: exec time=[%v], results count=[%v], looking for count=[%v], found count=[%v]", time.Since(startT), len(results.(model.Vector)), len(metricsWeAreLookingFor), len(metricsWeFound))
	return metricsWeFound, nil
}

// GetExistingMetricNames returns a list of the requested metric names that exist in Prometheus (meaning there is a matching __name__ label).
func (in *Client) GetExistingMetricNames(metricNames []string) ([]string, error) {
	if len(metricNames) == 0 {
		return []string{}, nil
	}

	zl := log.FromContext(in.ctx)

	zl.Trace().Msgf("GetExistingMetricNames: metricNames=[%v]", metricNames)
	startT := time.Now()
	results, warnings, err := in.api.LabelValues(in.ctx, "__name__", []string{}, time.Unix(0, 0), time.Now())
	if len(warnings) > 0 {
		zl.Warn().Msgf("GetExistingMetricNames. Prometheus Warnings: [%s]", strings.Join(warnings, ","))
	}
	if err != nil {
		return nil, errors.NewServiceUnavailable(err.Error())
	}

	metricsWeAreLookingFor := make(map[string]bool, len(metricNames))
	for i := 0; i < len(metricNames); i++ {
		metricsWeAreLookingFor[string(metricNames[i])] = true
	}

	metricsWeFound := make([]string, 0, len(metricNames))
	for _, item := range results {
		name := string(item)
		if metricsWeAreLookingFor[name] {
			metricsWeFound = append(metricsWeFound, name)
		}
	}

	zl.Trace().Msgf("GetExistingMetricNames: exec time=[%v], results count=[%v], looking for count=[%v], found count=[%v]", time.Since(startT), len(results), len(metricsWeAreLookingFor), len(metricsWeFound))
	return metricsWeFound, nil
}

// SanitizeLabelName replaces anything that doesn't match invalidLabelCharRE with an underscore.
// Copied from https://github.com/prometheus/prometheus/blob/df80dc4d3970121f2f76cba79050983ffb3cdbb0/util/strutil/strconv.go
func SanitizeLabelName(name string) string {
	return invalidLabelCharRE.ReplaceAllString(name, "_")
}
