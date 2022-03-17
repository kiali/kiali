package appender

import (
	"sync"
	"time"

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

	// Gather all the health data we'll need ahead of time key'd by namespace.
	appHealth := make(map[string]models.NamespaceAppHealth)
	serviceHealth := make(map[string]models.NamespaceServiceHealth)
	workloadHealth := make(map[string]models.NamespaceWorkloadHealth)
	type result struct {
		namespace      string
		appHealth      *models.NamespaceAppHealth
		serviceHealth  *models.NamespaceServiceHealth
		workloadHealth *models.NamespaceWorkloadHealth
		err            error
	}
	healthCh := make(chan result)
	var errors []error

	// Start accumulating results before fetching health info
	doneAccumulating := make(chan struct{})
	go func() {
		// Need to loop over healthCh until closed, otherwise any go routines
		// sending to this chan will remain blocked forever. Ideally as soon
		// as we get an error we'd propagate cancellation to all the running
		// goroutines.
		for res := range healthCh {
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
		doneAccumulating <- struct{}{}
	}()

	wg := sync.WaitGroup{}
	for namespace, kinds := range healthReqs {
		// use RequestedDuration as a default (for outsider nodes), otherwise use the safe duration for the requested namespace
		duration := a.RequestedDuration
		if ns, ok := a.Namespaces[namespace]; ok {
			duration = ns.Duration
		}

		for kind := range kinds {
			wg.Add(1)
			go func(namespace, kind string) {
				defer wg.Done()
				switch kind {
				case graph.NodeTypeApp:
					health, err := bs.Health.GetNamespaceAppHealth(ctx, namespace, duration.String(), time.Unix(a.QueryTime, 0))
					healthCh <- result{
						namespace: namespace,
						appHealth: &health,
						err:       err,
					}
				case graph.NodeTypeService:
					health, err := bs.Health.GetNamespaceServiceHealth(ctx, namespace, duration.String(), time.Unix(a.QueryTime, 0))
					healthCh <- result{
						namespace:     namespace,
						serviceHealth: &health,
						err:           err,
					}
				case graph.NodeTypeWorkload:
					health, err := bs.Health.GetNamespaceWorkloadHealth(ctx, namespace, duration.String(), time.Unix(a.QueryTime, 0))
					healthCh <- result{
						namespace:      namespace,
						workloadHealth: &health,
						err:            err,
					}
				}
			}(namespace, kind)
		}
	}

	// Wait until all results have been sent on the chan until closing
	wg.Wait()
	close(healthCh)
	<-doneAccumulating
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
