package appender

import (
	"context"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
)

const HealthAppenderName = "health"

// HealthAppender is responsible for calculating and attaching health status to graph nodes.
// Health status is calculated server-side using the traffic data collected during graph generation.
// Name: health
type HealthAppender struct {
	Namespaces        graph.NamespaceInfoMap
	QueryTime         int64 // unix time in seconds
	RequestedDuration time.Duration
}

// Name implements Appender
func (a HealthAppender) Name() string {
	return HealthAppenderName
}

// IsFinalizer implements Appender
func (a HealthAppender) IsFinalizer() bool {
	return true
}

// AppendGraph implements Appender
func (a HealthAppender) AppendGraph(ctx context.Context, trafficMap graph.TrafficMap, globalInfo *GlobalInfo, _ *AppenderNamespaceInfo) {
	if len(trafficMap) == 0 {
		return
	}

	a.attachHealthConfig(trafficMap, globalInfo)
	a.attachHealth(ctx, trafficMap, globalInfo)

	// Calculate and attach health status for each node
	calculator := business.NewHealthCalculator(globalInfo.Conf)
	a.calculateHealthStatus(trafficMap, calculator)
}

func addValueToRequests(requests map[string]map[string]float64, protocol, code string, val float64) {
	if _, ok := requests[protocol]; !ok {
		requests[protocol] = make(map[string]float64)
	}
	if _, ok := requests[protocol][code]; !ok {
		requests[protocol][code] = 0
	}
	requests[protocol][code] += val
}

// addEdgeToHealthData adds the edge's responses to the source and destination nodes' health data.
func addEdgeTrafficToNodeHealth(edge *graph.Edge) {
	source := edge.Source
	dest := edge.Dest
	initHealthData(source)
	initHealthData(dest)

	var (
		protocol  string
		responses graph.Responses
		ok        bool
	)
	if protocol, ok = edge.Metadata[graph.ProtocolKey].(string); !ok {
		return
	}
	if responses, ok = edge.Metadata[graph.MetadataKey(protocol+"Responses")].(graph.Responses); !ok {
		return
	}

	for code, detail := range responses {
		for _, val := range detail.Flags {
			switch source.NodeType {
			case graph.NodeTypeService:
				health := source.Metadata[graph.HealthData].(*models.ServiceHealth)
				addValueToRequests(health.Requests.Outbound, protocol, code, val)
				source.Metadata[graph.HealthData] = health
			case graph.NodeTypeWorkload:
				health := source.Metadata[graph.HealthData].(*models.WorkloadHealth)
				addValueToRequests(health.Requests.Outbound, protocol, code, val)
				source.Metadata[graph.HealthData] = health
			case graph.NodeTypeApp:
				health := source.Metadata[graph.HealthData].(*models.AppHealth)
				addValueToRequests(health.Requests.Outbound, protocol, code, val)
				source.Metadata[graph.HealthData] = health
				health = source.Metadata[graph.HealthDataApp].(*models.AppHealth)
				addValueToRequests(health.Requests.Outbound, protocol, code, val)
				source.Metadata[graph.HealthDataApp] = health
			}

			switch dest.NodeType {
			case graph.NodeTypeService:
				health := dest.Metadata[graph.HealthData].(*models.ServiceHealth)
				addValueToRequests(health.Requests.Inbound, protocol, code, val)
				dest.Metadata[graph.HealthData] = health
			case graph.NodeTypeWorkload:
				health := dest.Metadata[graph.HealthData].(*models.WorkloadHealth)
				addValueToRequests(health.Requests.Inbound, protocol, code, val)
				dest.Metadata[graph.HealthData] = health
			case graph.NodeTypeApp:
				health := dest.Metadata[graph.HealthData].(*models.AppHealth)
				addValueToRequests(health.Requests.Inbound, protocol, code, val)
				dest.Metadata[graph.HealthData] = health
				health = dest.Metadata[graph.HealthDataApp].(*models.AppHealth)
				addValueToRequests(health.Requests.Inbound, protocol, code, val)
				dest.Metadata[graph.HealthDataApp] = health
			}
		}
	}
}

func initHealthData(node *graph.Node) {
	if _, ok := node.Metadata[graph.HealthData]; !ok {
		switch node.NodeType {
		case graph.NodeTypeService:
			m := models.EmptyServiceHealth()
			node.Metadata[graph.HealthData] = &m
		case graph.NodeTypeWorkload:
			m := models.EmptyWorkloadHealth()
			node.Metadata[graph.HealthData] = m
		case graph.NodeTypeApp:
			m := models.EmptyAppHealth()
			mApp := models.EmptyAppHealth()
			node.Metadata[graph.HealthData] = &m
			node.Metadata[graph.HealthDataApp] = &mApp
		}
	}
}

func (a *HealthAppender) attachHealthConfig(trafficMap graph.TrafficMap, globalInfo *GlobalInfo) {
	for _, n := range trafficMap {
		// skip health for inaccessible nodes.  For now, include health for outsider nodes because edge health
		// may depend on any health config for those nodes.  And, users likely find the health useful.
		if b, ok := n.Metadata[graph.IsInaccessible]; ok && b.(bool) {
			continue
		}

		// for applicable node types, attach any custom health configuration.  additionally,
		switch n.NodeType {
		case graph.NodeTypeService:
			if srv, found := getServiceDefinition(n.Cluster, n.Namespace, n.Service, globalInfo); found {
				n.Metadata[graph.HasHealthConfig] = models.GetHealthAnnotation(srv.HealthAnnotations, models.GetHealthConfigAnnotation())
			}
		case graph.NodeTypeWorkload:
			if workload, found := getWorkload(n.Cluster, n.Namespace, n.Workload, globalInfo); found {
				n.Metadata[graph.HasHealthConfig] = models.GetHealthAnnotation(workload.HealthAnnotations, models.GetHealthConfigAnnotation())
			}
		default:
			continue
		}
	}
}

func (a *HealthAppender) attachHealth(ctx context.Context, trafficMap graph.TrafficMap, globalInfo *GlobalInfo) {
	var nodesWithHealth []*graph.Node
	type healthRequest struct {
		app       bool
		service   bool
		workload  bool
		cluster   string
		namespace string
	}

	// Health requests are per namespace meaning if a single node in the namespace
	// has health info then we send a namespace wide health request to fetch the
	// health info for the whole namespace.
	healthReqs := make(map[string]healthRequest)

	// Limit health fetches to only the necessary namespaces for the necessary types
	for _, n := range trafficMap {
		// This also gets initialized when summarizing health data from the edges but
		// not all nodes (idle nodes) have edges so we init the health data here as well.
		// Frontend expects the health data to not be null and will fail if it is.
		initHealthData(n)

		// skip health for inaccessible nodes.  For now, include health for outsider nodes because edge health
		// may depend on any health config for those nodes.  And, users likely find the health useful.
		if b, ok := n.Metadata[graph.IsInaccessible]; ok && b.(bool) {
			continue
		}

		var req healthRequest
		var ok bool
		if req, ok = healthReqs[n.Namespace+n.Cluster]; !ok {
			req = healthRequest{}
		}

		switch n.NodeType {
		case graph.NodeTypeApp:
			// always get app health for app node (used for app box health)
			req.app = true

			// for versioned app node, get workload health as well (used for the versioned app node itself)
			if graph.IsOK(n.Workload) {
				req.workload = true
			}
		case graph.NodeTypeWorkload:
			req.workload = true
		case graph.NodeTypeService:
			req.service = true
		}

		req.cluster = n.Cluster
		req.namespace = n.Namespace

		healthReqs[n.Namespace+n.Cluster] = req
		nodesWithHealth = append(nodesWithHealth, n)
	}

	bs := globalInfo.Business

	var cancel context.CancelFunc

	// TODO: Decide if this should be the request duration. If so,
	// then the user should be informed why the graph request failed
	// so that they can increase the refresh interval.
	const maxRequestDuration = time.Minute * 15
	ctx, cancel = context.WithTimeout(ctx, maxRequestDuration)
	defer cancel()

	type result struct {
		namespace        string
		cluster          string
		appNSHealth      models.NamespaceAppHealth
		serviceNSHealth  models.NamespaceServiceHealth
		workloadNSHealth models.NamespaceWorkloadHealth
		err              error
	}
	resultsCh := make(chan result)
	// Fetch all the health data in parallel. The health data will most likely be cached
	// and no prom queries are performed.
	go func(ctx context.Context) {
		wg := &sync.WaitGroup{}
		for _, req := range healthReqs {
			if req.app {
				wg.Add(1)
				go func(ctx context.Context, namespace, cluster string) {
					defer wg.Done()
					h, err := bs.Health.GetNamespaceAppHealth(ctx, business.NamespaceHealthCriteria{Namespace: namespace, Cluster: cluster, IncludeMetrics: false})
					resultsCh <- result{appNSHealth: h, namespace: namespace, err: err, cluster: cluster}
				}(ctx, req.namespace, req.cluster)
			}

			if req.workload {
				wg.Add(1)
				go func(ctx context.Context, namespace, cluster string) {
					defer wg.Done()
					h, err := bs.Health.GetNamespaceWorkloadHealth(ctx, business.NamespaceHealthCriteria{Namespace: namespace, Cluster: cluster, IncludeMetrics: false})
					resultsCh <- result{workloadNSHealth: h, namespace: namespace, err: err, cluster: cluster}
				}(ctx, req.namespace, req.cluster)
			}

			if req.service {
				wg.Add(1)
				go func(ctx context.Context, namespace, cluster string) {
					defer wg.Done()
					s, err := bs.Health.GetNamespaceServiceHealth(ctx, business.NamespaceHealthCriteria{Namespace: namespace, Cluster: cluster, IncludeMetrics: false})
					resultsCh <- result{serviceNSHealth: s, namespace: namespace, err: err, cluster: cluster}
				}(ctx, req.namespace, req.cluster)
			}
		}
		// Wait for all requests to finish sending before closing the channel.
		wg.Wait()
		close(resultsCh)
	}(ctx)

	// Note: these are key'd off of namespace+name instead of namespace to make lookups unique
	// and keep the map flatter.
	appHealth := make(map[string]*models.AppHealth)
	serviceHealth := make(map[string]*models.ServiceHealth)
	workloadHealth := make(map[string]*models.WorkloadHealth)
	var errors []error
	// This will block until all requests have finished.
	for result := range resultsCh {
		if result.err != nil {
			errors = append(errors, result.err)
			continue
		}

		if result.appNSHealth != nil {
			for name, health := range result.appNSHealth {
				appHealth[name+result.namespace+result.cluster] = health
			}
		} else if result.workloadNSHealth != nil {
			for name, health := range result.workloadNSHealth {
				workloadHealth[name+result.namespace+result.cluster] = health
			}
		} else if result.serviceNSHealth != nil {
			for name, health := range result.serviceNSHealth {
				serviceHealth[name+result.namespace+result.cluster] = health
			}
		}
	}
	if len(errors) > 0 {
		// This just panics with the first error.
		log.FromContext(ctx).Error().Msgf("all errors: %v", errors)
		graph.CheckError(errors[0])
	}

	for _, e := range trafficMap.Edges() {
		addEdgeTrafficToNodeHealth(e)
	}

	for _, n := range nodesWithHealth {
		switch n.NodeType {
		case graph.NodeTypeApp:
			var key graph.MetadataKey
			if graph.IsOK(n.Workload) {
				key = graph.HealthDataApp
			} else {
				key = graph.HealthData
			}

			var health *models.AppHealth
			if h, found := n.Metadata[key]; found {
				health = h.(*models.AppHealth)
			} else {
				health = &models.AppHealth{}
			}

			if h, found := appHealth[n.App+n.Namespace+n.Cluster]; found {
				health.WorkloadStatuses = h.WorkloadStatuses
				health.Requests.HealthAnnotations = h.Requests.HealthAnnotations
			}
			n.Metadata[key] = health
		case graph.NodeTypeService:
			var health *models.ServiceHealth
			if h, found := n.Metadata[graph.HealthData]; found {
				health = h.(*models.ServiceHealth)
			} else {
				health = &models.ServiceHealth{}
			}

			if h, found := serviceHealth[n.Service+n.Namespace+n.Cluster]; found {
				health.Requests.HealthAnnotations = h.Requests.HealthAnnotations
			}
			n.Metadata[graph.HealthData] = health
		case graph.NodeTypeWorkload:
			var health *models.WorkloadHealth
			if h, found := n.Metadata[graph.HealthData]; found {
				health = h.(*models.WorkloadHealth)
			} else {
				health = &models.WorkloadHealth{}
			}

			if h, found := workloadHealth[n.Workload+n.Namespace+n.Cluster]; found {
				health.WorkloadStatus = h.WorkloadStatus
				health.Requests.HealthAnnotations = h.Requests.HealthAnnotations
			}
			n.Metadata[graph.HealthData] = health
		}
	}
}

// calculateHealthStatus calculates and sets the health status for each node and edge in the traffic map.
// This consolidates health status calculation on the server side, using the traffic data
// collected during graph generation rather than relying on cached health data (because the cached data
// uses a fixed duration and likely a different time time period).
func (a *HealthAppender) calculateHealthStatus(trafficMap graph.TrafficMap, calculator *business.HealthCalculator) {
	// Calculate edge health first (needs node health configs)
	a.calculateEdgeHealthStatus(trafficMap, calculator)

	// Then calculate node health
	for _, n := range trafficMap {
		// Skip inaccessible nodes - they don't have health data
		if b, ok := n.Metadata[graph.IsInaccessible]; ok && b.(bool) {
			continue
		}

		// Get health annotations for custom thresholds
		var annotations map[string]string
		if val, ok := n.Metadata[graph.HasHealthConfig]; ok {
			annotations = val.(map[string]string)
		}

		switch n.NodeType {
		case graph.NodeTypeApp:
			// For versioned app nodes, we have both HealthData (workload health) and HealthDataApp (app health)
			// For non-versioned app nodes, we only have HealthData (app health)
			if graph.IsOK(n.Workload) {
				// Versioned app node: calculate status for the versioned app (uses workload health as base)
				if h, found := n.Metadata[graph.HealthData]; found {
					if health, ok := h.(*models.AppHealth); ok {
						calculated := calculator.CalculateAppHealth(n.Namespace, n.App, health, annotations)
						health.Status = &calculated
					}
				}
				// Also calculate status for the app box health
				if h, found := n.Metadata[graph.HealthDataApp]; found {
					if health, ok := h.(*models.AppHealth); ok {
						calculated := calculator.CalculateAppHealth(n.Namespace, n.App, health, annotations)
						health.Status = &calculated
					}
				}
			} else {
				// Non-versioned app node
				if h, found := n.Metadata[graph.HealthData]; found {
					if health, ok := h.(*models.AppHealth); ok {
						calculated := calculator.CalculateAppHealth(n.Namespace, n.App, health, annotations)
						health.Status = &calculated
					}
				}
			}
		case graph.NodeTypeService:
			if h, found := n.Metadata[graph.HealthData]; found {
				if health, ok := h.(*models.ServiceHealth); ok {
					calculated := calculator.CalculateServiceHealth(n.Namespace, n.Service, health, annotations)
					health.Status = &calculated
				}
			}
		case graph.NodeTypeWorkload:
			if h, found := n.Metadata[graph.HealthData]; found {
				if health, ok := h.(*models.WorkloadHealth); ok {
					calculated := calculator.CalculateWorkloadHealth(n.Namespace, n.Workload, health, annotations)
					health.Status = &calculated
				}
			}
		}
	}
}

// calculateEdgeHealthStatus calculates health status for each edge in the traffic map.
// Edge health is based on error rates in the traffic, using tolerances from both
// source (outbound) and destination (inbound) nodes.
func (a *HealthAppender) calculateEdgeHealthStatus(trafficMap graph.TrafficMap, calculator *business.HealthCalculator) {
	for _, n := range trafficMap {
		for _, e := range n.Edges {
			status := a.calculateSingleEdgeHealth(e, calculator)
			if status != models.HealthStatusNA {
				e.Metadata[graph.HealthStatus] = string(status)
			}
		}
	}
}

// calculateSingleEdgeHealth calculates health status for a single edge.
func (a *HealthAppender) calculateSingleEdgeHealth(edge *graph.Edge, calculator *business.HealthCalculator) models.HealthStatus {
	source := edge.Source
	dest := edge.Dest

	// Get protocol from edge
	protocol, ok := edge.Metadata[graph.ProtocolKey].(string)
	if !ok || protocol == "" {
		return models.HealthStatusNA
	}

	// Get responses for this protocol
	responsesKey := graph.MetadataKey(protocol + "Responses")
	responses, ok := edge.Metadata[responsesKey].(graph.Responses)
	if !ok || len(responses) == 0 {
		return models.HealthStatusNA
	}

	// Calculate total requests and error counts
	totalRequests := float64(0)
	for _, detail := range responses {
		for _, val := range detail.Flags {
			totalRequests += val
		}
	}

	if totalRequests == 0 {
		return models.HealthStatusNA
	}

	// Get health annotations from source and dest nodes
	sourceAnnotations := getNodeHealthAnnotations(source)
	destAnnotations := getNodeHealthAnnotations(dest)

	// Get tolerances for source (outbound) and dest (inbound)
	sourceName := getNodeName(source)
	destName := getNodeName(dest)

	sourceTolerances := calculator.GetTolerancesForDirection(source.Namespace, sourceName, source.NodeType, "outbound", sourceAnnotations)
	destTolerances := calculator.GetTolerancesForDirection(dest.Namespace, destName, dest.NodeType, "inbound", destAnnotations)

	// Calculate status for outbound (from source perspective)
	outboundStatus := a.calculateEdgeStatusWithTolerances(responses, protocol, totalRequests, sourceTolerances)

	// Calculate status for inbound (from dest perspective)
	inboundStatus := a.calculateEdgeStatusWithTolerances(responses, protocol, totalRequests, destTolerances)

	// Return the worse status
	return models.MergeHealthStatus(outboundStatus, inboundStatus)
}

// calculateEdgeStatusWithTolerances calculates edge health status using the given tolerances.
func (a *HealthAppender) calculateEdgeStatusWithTolerances(
	responses graph.Responses,
	protocol string,
	totalRequests float64,
	tolerances []config.Tolerance,
) models.HealthStatus {
	if len(tolerances) == 0 {
		// No matching tolerances, check if there's traffic
		if totalRequests > 0 {
			return models.HealthStatusHealthy
		}
		return models.HealthStatusNA
	}

	worstStatus := models.HealthStatusNA

	for _, tol := range tolerances {
		// Check if this tolerance matches the protocol
		if !matchesPattern(tol.Protocol, protocol) {
			continue
		}

		// Sum up error count for matching response codes
		errorCount := float64(0)
		for code, detail := range responses {
			if matchesCodePattern(tol.Code, code) {
				for _, val := range detail.Flags {
					errorCount += val
				}
			}
		}

		if totalRequests > 0 {
			errorRatio := (errorCount / totalRequests) * 100

			var status models.HealthStatus
			if tol.Failure > 0 && errorRatio >= float64(tol.Failure) {
				status = models.HealthStatusFailure
			} else if tol.Degraded > 0 && errorRatio >= float64(tol.Degraded) {
				status = models.HealthStatusDegraded
			} else {
				status = models.HealthStatusHealthy
			}

			if models.HealthStatusPriority(status) > models.HealthStatusPriority(worstStatus) {
				worstStatus = status
			}
		}
	}

	// If we have traffic but no tolerance matched, consider it healthy
	if worstStatus == models.HealthStatusNA && totalRequests > 0 {
		return models.HealthStatusHealthy
	}

	return worstStatus
}

// getNodeHealthAnnotations returns the health annotations for a node, if any.
func getNodeHealthAnnotations(n *graph.Node) map[string]string {
	if val, ok := n.Metadata[graph.HasHealthConfig]; ok {
		if annotations, ok := val.(map[string]string); ok {
			return annotations
		}
	}
	return nil
}

// getNodeName returns the appropriate name for a node based on its type.
func getNodeName(n *graph.Node) string {
	switch n.NodeType {
	case graph.NodeTypeService:
		return n.Service
	case graph.NodeTypeWorkload:
		return n.Workload
	case graph.NodeTypeApp:
		return n.App
	default:
		return ""
	}
}

// matchesCodePattern checks if a response code matches a code pattern (e.g., "5XX" matches "500", "501", etc.)
func matchesCodePattern(pattern, code string) bool {
	if pattern == "" || pattern == ".*" {
		return true
	}

	// Replace X/x with \d for digit matching (matches frontend behavior)
	regexPattern := strings.ReplaceAll(pattern, "X", `\d`)
	regexPattern = strings.ReplaceAll(regexPattern, "x", `\d`)

	return matchesPattern(regexPattern, code)
}

// matchesPattern checks if a value matches a regex pattern
func matchesPattern(pattern, value string) bool {
	if pattern == "" || pattern == ".*" {
		return true
	}

	// Ensure full string match
	fullPattern := pattern
	if !strings.HasPrefix(fullPattern, "^") {
		fullPattern = "^" + fullPattern
	}
	if !strings.HasSuffix(fullPattern, "$") {
		fullPattern = fullPattern + "$"
	}

	re, err := regexp.Compile(fullPattern)
	if err != nil {
		// Invalid regex, fall back to exact match
		return pattern == value
	}

	return re.MatchString(value)
}
