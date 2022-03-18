package appender

import (
	"context"
	"fmt"
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

	mu sync.Mutex
}

// Name implements Appender
func (a *HealthAppender) Name() string {
	return HealthAppenderName
}

// IsFinalizer implements Appender
func (a *HealthAppender) IsFinalizer() bool {
	return true
}

// AppendGraph implements Appender
func (a *HealthAppender) AppendGraph(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, _ *graph.AppenderNamespaceInfo) {
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

type result struct {
	namespace      string
	appHealth      *models.NamespaceAppHealth
	serviceHealth  *models.NamespaceServiceHealth
	workloadHealth *models.NamespaceWorkloadHealth
	err            error
}

func (a *HealthAppender) attachHealth(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo) {
	healthReqs := make(map[string]map[string][]*graph.Node)

	// Limit health fetches to only the necessary namespaces for the necessary types
	for _, n := range trafficMap {
		// skip health for inaccessible nodes.  For now, include health for outsider nodes because edge health
		// may depend on any health config for those nodes.  And, users likely find the health useful.
		if b, ok := n.Metadata[graph.IsInaccessible]; ok && b.(bool) {
			continue
		}

		switch n.NodeType {
		case graph.NodeTypeApp:
			if _, nsOk := healthReqs[n.Namespace]; !nsOk {
				healthReqs[n.Namespace] = make(map[string][]*graph.Node)
			}
			// always get app health for app node (used for app box health)
			healthReqs[n.Namespace][graph.NodeTypeApp] = append(healthReqs[n.Namespace][graph.NodeTypeApp], n)

			// for versioned app node, get workload health as well (used for the versioned app node itself)
			if graph.IsOK(n.Workload) {
				healthReqs[n.Namespace][graph.NodeTypeWorkload] = append(healthReqs[n.Namespace][graph.NodeTypeWorkload], n)
			}
		case graph.NodeTypeWorkload:
			if _, nsOk := healthReqs[n.Namespace]; !nsOk {
				healthReqs[n.Namespace] = make(map[string][]*graph.Node)
			}

			healthReqs[n.Namespace][graph.NodeTypeWorkload] = append(healthReqs[n.Namespace][graph.NodeTypeWorkload], n)
		case graph.NodeTypeService:
			if _, nsOk := healthReqs[n.Namespace]; !nsOk {
				healthReqs[n.Namespace] = make(map[string][]*graph.Node)
			}

			healthReqs[n.Namespace][graph.NodeTypeService] = append(healthReqs[n.Namespace][graph.NodeTypeService], n)
		}
	}

	// Execute health fetches and attach retrieved health data to nodes
	bs := globalInfo.Business
	ctx := globalInfo.Context
	if ctx == nil {
		ctx = context.Background()
	}

	// Gather all the health data we'll need ahead of time key'd by namespace.
	appHealth := make(map[string]models.NamespaceAppHealth)
	serviceHealth := make(map[string]models.NamespaceServiceHealth)
	workloadHealth := make(map[string]models.NamespaceWorkloadHealth)

	var cancel context.CancelFunc
	ctx, cancel = context.WithTimeout(ctx, time.Second*30) // If all the node health reqs take > 30s, there is a problem.
	defer cancel()
	resultsCh := a.getGraphNodeHealth(ctx, bs, healthReqs)

	// Need to loop over resultsCh until closed, otherwise any go routines
	// sending to this chan will remain blocked forever. Ideally as soon
	// as we get an error we'd propagate cancellation to all the running
	// goroutines.
	var errors []error
	for res := range resultsCh {
		if res.err != nil {
			errors = append(errors, res.err)
		}
		if res.appHealth != nil {
			appHealth[res.namespace] = *res.appHealth
		} else if res.serviceHealth != nil {
			serviceHealth[res.namespace] = *res.serviceHealth
		} else if res.workloadHealth != nil {
			workloadHealth[res.namespace] = *res.workloadHealth
		}
	}

	if len(errors) > 0 {
		// Check for error needs to happen in the main routine or else panic won't get propagated up
		graph.CheckError(errors[0])
	}

	for namespace, kinds := range healthReqs {
		for kind, nodes := range kinds {
			switch kind {
			case graph.NodeTypeApp:
				health := appHealth[namespace]
				for _, n := range nodes {
					if h, ok := health[n.App]; ok {
						// versionedApp nodes store the app health (for use with appBox health) but natively reflect workload health
						if graph.IsOK(n.Workload) {
							n.Metadata[graph.HealthDataApp] = h
						} else {
							n.Metadata[graph.HealthData] = h
						}
					} else {
						n.Metadata[graph.HealthData] = []int{}
						log.Tracef("No health found for [%s] [%s]", n.NodeType, n.App)
					}
				}
			case graph.NodeTypeService:
				health := serviceHealth[namespace]
				for _, n := range nodes {
					if h, ok := health[n.Service]; ok {
						n.Metadata[graph.HealthData] = h
					} else {
						n.Metadata[graph.HealthData] = []int{}
						log.Tracef("No health found for [%s] [%s]", n.NodeType, n.Service)
					}
				}
			case graph.NodeTypeWorkload:
				health := workloadHealth[namespace]
				for _, n := range nodes {
					if h, ok := health[n.Workload]; ok {
						n.Metadata[graph.HealthData] = h
					} else {
						n.Metadata[graph.HealthData] = []int{}
						log.Tracef("No health found for [%s] [%s]", n.NodeType, n.Workload)
					}
				}
			}
		}
	}
}

// getNamespaceDuration gets the duration for a given namespace. Safe for concurrent use.
func (a *HealthAppender) getNamespaceDuration(namespace string) time.Duration {
	a.mu.Lock()
	defer a.mu.Unlock()

	duration := a.RequestedDuration
	if ns, ok := a.Namespaces[namespace]; ok {
		duration = ns.Duration
	}

	return duration
}

// getGraphNodeHealth fetches the health for each node in the graph and sends the results
// to the returned chan. The result chan will be closed after all results have been sent.
// Callers should not close the results chan.
func (a *HealthAppender) getGraphNodeHealth(ctx context.Context, bs *business.Layer, healthReqs map[string]map[string][]*graph.Node) <-chan result {
	type work struct {
		namespace string
		kind      string
		duration  time.Duration
	}

	resultsCh := make(chan result)

	go func() {
		workCh := make(chan work)
		const numberOfGetters = 20

		// We need to close the resultsCh after all the workers are finished. We track when the
		// last worker exits with the waitgroup.
		wg := sync.WaitGroup{}
		wg.Add(numberOfGetters)

		for i := 0; i < numberOfGetters; i++ {
			// Start the workers in separate goroutines. Each one of these will read from
			// the workCh until the workCh is closed and then exit.
			go func(ctx context.Context) {
				defer wg.Done()

				for w := range workCh {
					var res result
					switch w.kind {
					case graph.NodeTypeApp:
						health, err := bs.Health.GetNamespaceAppHealth(ctx, w.namespace, w.duration.String(), time.Unix(a.QueryTime, 0))
						res.appHealth = &health
						res.err = err
					case graph.NodeTypeService:
						health, err := bs.Health.GetNamespaceServiceHealth(ctx, w.namespace, w.duration.String(), time.Unix(a.QueryTime, 0))
						res.serviceHealth = &health
						res.err = err
					case graph.NodeTypeWorkload:
						health, err := bs.Health.GetNamespaceWorkloadHealth(ctx, w.namespace, w.duration.String(), time.Unix(a.QueryTime, 0))
						res.workloadHealth = &health
						res.err = err
					default:
						res.err = fmt.Errorf("unrecognized node type: %s. HealthAppender only works for '%s', '%s', and '%s' node types", w.kind, graph.NodeTypeApp, graph.NodeTypeBox, graph.NodeTypeWorkload)
					}

					resultsCh <- res
				}
			}(ctx)
		}

		// Put work items into the workCh that the worker goroutines will then read from.
		for namespace, kinds := range healthReqs {
			duration := a.getNamespaceDuration(namespace)

			for kind := range kinds {
				workCh <- work{kind: kind, duration: duration, namespace: namespace}
			}
		}
		// At this point we've sent all the work items to the workers.
		// Closing the workCh will cause the workers goroutines to exit.
		close(workCh)
		// Wait until all the workers have returned/exited then close the resultsCh.
		wg.Wait()
		close(resultsCh)
	}()

	return resultsCh
}
