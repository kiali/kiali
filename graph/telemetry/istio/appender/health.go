package appender

import (
	"context"
	"sync"
	"time"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
)

const HealthAppenderName = "health"

// HealthAppender is responsible for adding the information needed to perform client-side health calculations. This
// includes both health configuration, and health data, to the graph.  TODO: replace this with server-side
// health calculation, and report only the health results.
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
