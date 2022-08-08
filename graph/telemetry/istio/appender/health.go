package appender

import (
	"context"
	"sync"
	"time"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/graph"
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
func (a HealthAppender) AppendGraph(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, _ *graph.AppenderNamespaceInfo) {
	if len(trafficMap) == 0 {
		return
	}

	a.attachHealthConfig(trafficMap, globalInfo)
	a.attachHealth(trafficMap, globalInfo)
}

func (a *HealthAppender) attachHealthConfig(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo) {
	for _, n := range trafficMap {
		// skip health for inaccessible nodes.  For now, include health for outsider nodes because edge health
		// may depend on any health config for those nodes.  And, users likely find the health useful.
		if b, ok := n.Metadata[graph.IsInaccessible]; ok && b.(bool) {
			continue
		}

		// for applicable node types, attach any custom health configuration.  additionally,
		switch n.NodeType {
		case graph.NodeTypeService:
			if srv, found := getServiceDefinition(n.Namespace, n.Service, globalInfo); found {
				n.Metadata[graph.HasHealthConfig] = models.GetHealthAnnotation(srv.HealthAnnotations, models.GetHealthConfigAnnotation())
			}
		case graph.NodeTypeWorkload:
			if workload, found := getWorkload(n.Namespace, n.Workload, globalInfo); found {
				n.Metadata[graph.HasHealthConfig] = models.GetHealthAnnotation(workload.HealthAnnotations, models.GetHealthConfigAnnotation())
			}
		default:
			continue
		}
	}
}

func (a *HealthAppender) attachHealth(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo) {
	type healthRequest struct {
		app      bool
		service  bool
		workload bool
	}

	// Health requests are per namespace meaning if a single node in the namespace
	// has health info then we send a namespace wide health request to fetch the
	// health info for the whole namespace.
	healthReqs := make(map[string]healthRequest)
	var nodesWithHealth []*graph.Node

	// Limit health fetches to only the necessary namespaces for the necessary types
	for _, n := range trafficMap {
		// skip health for inaccessible nodes.  For now, include health for outsider nodes because edge health
		// may depend on any health config for those nodes.  And, users likely find the health useful.
		if b, ok := n.Metadata[graph.IsInaccessible]; ok && b.(bool) {
			continue
		}

		var req healthRequest
		var ok bool
		if req, ok = healthReqs[n.Namespace]; !ok {
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

		healthReqs[n.Namespace] = req
		nodesWithHealth = append(nodesWithHealth, n)
	}

	bs := globalInfo.Business
	ctx := globalInfo.Context

	var cancel context.CancelFunc
	if ctx == nil {
		ctx = context.Background()
	}
	// All requests shouldn't take longer than the requested duration.
	ctx, cancel = context.WithTimeout(ctx, a.RequestedDuration)
	defer cancel()

	type result struct {
		namespace        string
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
		for namespace, req := range healthReqs {
			if req.app {
				wg.Add(1)
				go func(ctx context.Context, namespace string) {
					defer wg.Done()
					h, err := bs.Health.GetNamespaceAppHealth(ctx, business.NamespaceHealthCriteria{Namespace: namespace, IncludeMetrics: false})
					resultsCh <- result{appNSHealth: h, namespace: namespace, err: err}
				}(ctx, namespace)
			}

			if req.workload {
				wg.Add(1)
				go func(ctx context.Context, namespace string) {
					defer wg.Done()
					h, err := bs.Health.GetNamespaceWorkloadHealth(ctx, business.NamespaceHealthCriteria{Namespace: namespace, IncludeMetrics: false})
					resultsCh <- result{workloadNSHealth: h, namespace: namespace, err: err}
				}(ctx, namespace)
			}

			if req.service {
				wg.Add(1)
				go func(ctx context.Context, namespace string) {
					defer wg.Done()
					s, err := bs.Health.GetNamespaceServiceHealth(ctx, business.NamespaceHealthCriteria{Namespace: namespace, IncludeMetrics: false})
					resultsCh <- result{serviceNSHealth: s, namespace: namespace, err: err}
				}(ctx, namespace)
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
				appHealth[name+result.namespace] = health
			}
		} else if result.workloadNSHealth != nil {
			for name, health := range result.workloadNSHealth {
				workloadHealth[name+result.namespace] = health
			}
		} else if result.serviceNSHealth != nil {
			for name, health := range result.serviceNSHealth {
				serviceHealth[name+result.namespace] = health
			}
		}
	}
	if len(errors) > 0 {
		// This just panics with the first error.
		graph.CheckError(errors[0])
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

			if h, found := appHealth[n.App+n.Namespace]; found {
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

			if h, found := serviceHealth[n.Service+n.Namespace]; found {
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

			if h, found := workloadHealth[n.Workload+n.Namespace]; found {
				health.WorkloadStatus = h.WorkloadStatus
				health.Requests.HealthAnnotations = h.Requests.HealthAnnotations
			}
			n.Metadata[graph.HealthData] = health
		}
	}
}
