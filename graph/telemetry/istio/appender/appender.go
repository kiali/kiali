package appender

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util/sliceutil"
)

func NewIstioInfo() *IstioInfo {
	return &IstioInfo{
		AmbientWaypoints:  make(map[NodeKey]bool),
		AppsMap:           make(map[string]map[string]*models.AppListItem),
		ServiceEntryHosts: make(map[string]serviceEntryHosts),
		ServiceLists:      make(map[string]*models.ServiceList),
		WorkloadLists:     make(map[string]*models.WorkloadList),
		WorkloadMap:       make(map[NodeKey]*graph.Node),
	}
}

type NodeKey struct {
	Cluster   string
	Namespace string
	Name      string
}

// IstioInfo contains structured information for Istio telemetry vendor
type IstioInfo struct {
	// AmbientWaypoints maps waypoint keys to their availability status
	AmbientWaypoints any
	// AppsMap contains application list items keyed by cluster:namespace
	AppsMap map[string]map[string]*models.AppListItem
	// ServiceEntryHosts maps composite keys (serviceEntryHostsKey:cluster:namespace) to service entry hosts
	ServiceEntryHosts map[string]serviceEntryHosts
	// ServiceLists caches service lists by cluster:namespace key
	ServiceLists map[string]*models.ServiceList
	// WorkloadLists caches workload lists by cluster:namespace key
	WorkloadLists map[string]*models.WorkloadList
	// WorkloadMap maps workloads to their nodes on the map. Only available to finalizers
	// since the full graph hasn't been generated until all appenders have run.
	WorkloadMap map[NodeKey]*graph.Node
}

type (
	GlobalInfo            = graph.GlobalInfo[*IstioInfo]
	AppenderNamespaceInfo = graph.AppenderNamespaceInfo[*IstioInfo]
	Appender              = graph.Appender[*IstioInfo]
)

const (
	defaultAggregate      = "request_operation"
	defaultQuantile       = 0.95
	defaultThroughputType = "response"
	defaultWaypoints      = true
)

func NewAppenderNamespaceInfo(namespace string) *AppenderNamespaceInfo {
	return &AppenderNamespaceInfo{Namespace: namespace, Vendor: NewIstioInfo()}
}

// ParseAppenders determines which appenders should run for this graphing request
func ParseAppenders(o graph.TelemetryOptions) (appenders []Appender, finalizers []Appender) {
	requestedAppenders := map[string]bool{}
	requestedFinalizers := map[string]bool{}

	if !o.Appenders.All {
		for _, appenderName := range o.Appenders.AppenderNames {
			switch appenderName {

			// namespace appenders
			case AggregateNodeAppenderName:
				requestedAppenders[AggregateNodeAppenderName] = true
			case DeadNodeAppenderName:
				requestedAppenders[DeadNodeAppenderName] = true
			case IdleNodeAppenderName:
				requestedAppenders[IdleNodeAppenderName] = true
			case MeshCheckAppenderName, SidecarsCheckAppenderName:
				requestedAppenders[MeshCheckAppenderName] = true
			case ResponseTimeAppenderName:
				requestedAppenders[ResponseTimeAppenderName] = true
			case SecurityPolicyAppenderName:
				requestedAppenders[SecurityPolicyAppenderName] = true
			case ServiceEntryAppenderName:
				requestedAppenders[ServiceEntryAppenderName] = true
			case ThroughputAppenderName:
				requestedAppenders[ThroughputAppenderName] = true
			case WorkloadEntryAppenderName:
				requestedAppenders[WorkloadEntryAppenderName] = true

			// finalizer appenders
			case AmbientAppenderName:
				requestedFinalizers[AmbientAppenderName] = true
			case HealthAppenderName:
				// currently, because health is still calculated in the client, if requesting health
				// we also need to run the healthConfig appender.  Eventually, asking for health will supply
				// the result of a server-side health calculation.
				requestedFinalizers[HealthAppenderName] = true
			case IstioAppenderName:
				requestedFinalizers[IstioAppenderName] = true
			case LabelerAppenderName:
				requestedFinalizers[LabelerAppenderName] = true
			case OutsiderAppenderName, TrafficGeneratorAppenderName:
				// skip - these are always run, ignore if specified
			case "":
				// skip
			default:
				graph.BadRequest(fmt.Sprintf("Invalid appender [%s]", appenderName))
			}
		}
	}

	// The appender order is important
	// To pre-process service nodes run service_entry appender first
	// To reduce processing, filter dead nodes next
	// To reduce processing, next run appenders that don't apply to idle (aka unused) services
	// - lazily inject aggregate nodes so other decorations can influence the new nodes/edges, if necessary
	// Add orphan (idle) services
	// Run remaining appenders
	if _, ok := requestedAppenders[ServiceEntryAppenderName]; ok || o.Appenders.All {
		a := ServiceEntryAppender{
			AccessibleNamespaces: o.AccessibleNamespaces,
			GraphType:            o.GraphType,
		}
		appenders = append(appenders, a)
	}
	if _, ok := requestedAppenders[DeadNodeAppenderName]; ok || o.Appenders.All {
		a := DeadNodeAppender{
			AccessibleNamespaces: o.AccessibleNamespaces,
		}
		appenders = append(appenders, a)
	}
	if _, ok := requestedAppenders[WorkloadEntryAppenderName]; ok || o.Appenders.All {
		a := WorkloadEntryAppender{
			AccessibleNamespaces: o.AccessibleNamespaces,
		}
		appenders = append(appenders, a)
	}
	if _, ok := requestedAppenders[ResponseTimeAppenderName]; ok || o.Appenders.All {
		quantile := defaultQuantile
		responseTimeString := o.Params.Get("responseTime")
		if responseTimeString != "" {
			switch responseTimeString {
			case "avg":
				quantile = 0.0
			case "50":
				quantile = 0.5
			case "95":
				quantile = 0.95
			case "99":
				quantile = 0.99
			default:
				graph.BadRequest(fmt.Sprintf(`Invalid responseTime, must be one of: avg | 50 | 95 | 99: [%s]`, responseTimeString))
			}
		}
		a := ResponseTimeAppender{
			Quantile:           quantile,
			GraphType:          o.GraphType,
			InjectServiceNodes: o.InjectServiceNodes,
			Namespaces:         o.Namespaces,
			QueryTime:          o.QueryTime,
			Rates:              o.Rates,
		}
		appenders = append(appenders, a)
	}
	if _, ok := requestedAppenders[SecurityPolicyAppenderName]; ok || o.Appenders.All {
		a := SecurityPolicyAppender{
			GraphType:          o.GraphType,
			InjectServiceNodes: o.InjectServiceNodes,
			Namespaces:         o.Namespaces,
			QueryTime:          o.QueryTime,
			Rates:              o.Rates,
		}
		appenders = append(appenders, a)
	}
	if _, ok := requestedAppenders[ThroughputAppenderName]; ok || o.Appenders.All {
		throughputType := o.Params.Get("throughputType")
		if throughputType != "" {
			if throughputType != "request" && throughputType != "response" {
				graph.BadRequest(fmt.Sprintf("Invalid throughputType, expecting one of (request, response). [%s]", throughputType))
			}
		} else {
			throughputType = defaultThroughputType
		}
		a := ThroughputAppender{
			GraphType:          o.GraphType,
			InjectServiceNodes: o.InjectServiceNodes,
			Namespaces:         o.Namespaces,
			QueryTime:          o.QueryTime,
			Rates:              o.Rates,
			ThroughputType:     throughputType,
		}
		appenders = append(appenders, a)
	}
	if _, ok := requestedAppenders[AggregateNodeAppenderName]; ok || o.Appenders.All {
		aggregate := o.Aggregate
		if aggregate == "" {
			if aggregate = o.Params.Get("aggregate"); aggregate == "" {
				aggregate = defaultAggregate
			}
		}
		a := AggregateNodeAppender{
			Aggregate:          aggregate,
			AggregateValue:     o.AggregateValue,
			GraphType:          o.GraphType,
			InjectServiceNodes: o.InjectServiceNodes,
			Namespaces:         o.Namespaces,
			QueryTime:          o.QueryTime,
			Rates:              o.Rates,
			Service:            o.Service,
		}
		appenders = append(appenders, a)
	}
	if _, ok := requestedAppenders[IdleNodeAppenderName]; ok || o.Appenders.All {
		hasNodeOptions := o.App != "" || o.Workload != "" || o.Service != ""
		a := IdleNodeAppender{
			GraphType:          o.GraphType,
			InjectServiceNodes: o.InjectServiceNodes,
			IsNodeGraph:        hasNodeOptions,
		}
		appenders = append(appenders, a)
	}
	if _, ok := requestedAppenders[MeshCheckAppenderName]; ok || o.Appenders.All {
		a := MeshCheckAppender{
			AccessibleNamespaces: o.AccessibleNamespaces,
		}
		appenders = append(appenders, a)
	}

	// The finalizer order is important

	// always run the extensions finalizer first, it can add additional nodes and edges
	finalizers = append(finalizers, &ExtensionsAppender{
		Duration:         o.Duration,
		GraphType:        o.GraphType,
		IncludeIdleEdges: o.IncludeIdleEdges,
		QueryTime:        o.QueryTime,
		Rates:            o.Rates,
		ShowUnrooted:     true, // ToDo possibly make this an option
	})

	// always run the outsider finalizer next, this allows other finalizers to
	// utilize graph.isInaccessible and graph.isOutside metatdata values.
	finalizers = append(finalizers, &OutsiderAppender{
		AccessibleNamespaces: o.AccessibleNamespaces,
		Namespaces:           o.Namespaces,
	})

	if _, ok := requestedFinalizers[IstioAppenderName]; ok {
		finalizers = append(finalizers, &IstioAppender{})
	}

	if _, ok := requestedFinalizers[AmbientAppenderName]; ok || o.Appenders.All {
		waypoints := defaultWaypoints
		waypointsString := o.Params.Get("waypoints")
		if waypointsString != "" {
			var waypointsErr error
			waypoints, waypointsErr = strconv.ParseBool(waypointsString)
			if waypointsErr != nil {
				graph.BadRequest(fmt.Sprintf("Invalid waypoints param [%s]", waypointsString))
			}
		}
		finalizers = append(finalizers, &AmbientAppender{
			AccessibleNamespaces: o.AccessibleNamespaces,
			ShowWaypoints:        waypoints,
		})
	}

	// if health finalizer is to be run, do it after the outsider finalizer
	if _, ok := requestedFinalizers[HealthAppenderName]; ok {
		finalizers = append(finalizers, &HealthAppender{
			Namespaces:        o.Namespaces,
			QueryTime:         o.QueryTime,
			RequestedDuration: o.Duration,
		})
	}

	// if labeler finalizer is to be run, do it after the outsider finalizer
	if _, ok := requestedFinalizers[LabelerAppenderName]; ok {
		finalizers = append(finalizers, &LabelerAppender{})
	}

	// always run the traffic generator finalizer
	finalizers = append(finalizers, &TrafficGeneratorAppender{})

	return appenders, finalizers
}

const (
	AmbientWaypoints     = "ambientWaypoints"     // global vendor info models.Workloads
	appsMapKey           = "appsMapKey"           // global vendor info map[cluster:namespace]appsMap
	serviceEntryHostsKey = "serviceEntryHostsKey" // global vendor info service entries for all accessible namespaces
	serviceListKey       = "serviceListKey"       // global vendor info map[cluster:namespace]serviceDefinitionList
	workloadListKey      = "workloadListKey"      // global vendor info map[cluster:namespace]workloadListKey
)

type serviceEntry struct {
	cluster   string
	exportTo  []string
	hosts     []string
	location  string
	name      string // serviceEntry name
	namespace string // namespace in which the service entry is defined
}

type serviceEntryHosts map[string][]*serviceEntry

type appsMap map[string]*models.AppListItem

func newServiceEntryHosts() serviceEntryHosts {
	return make(serviceEntryHosts)
}

func (seh serviceEntryHosts) addHost(host string, se *serviceEntry) {
	seArr := []*serviceEntry{se}
	if serviceEntriesForHost, ok := seh[host]; ok {
		// if the same host is defined in multiple service entries, prefer the most
		// specific namespace match when checking for a match...
		if se.exportTo == nil || se.exportTo[0] == "*" {
			seh[host] = append(serviceEntriesForHost, seArr...)
		} else {
			seh[host] = append(seArr, serviceEntriesForHost...)
		}
	} else {
		seh[host] = seArr
	}
	se.hosts = append(se.hosts, host)
}

// getServiceLists returns a map[clusterName]*models.ServiceList for all clusters with traffic in the namespace, or if trafficMap is nil
// then all clusters on which the namespace is valid.
func getServiceLists(trafficMap graph.TrafficMap, namespace string, gi *GlobalInfo) map[string]*models.ServiceList {
	clusters := getTrafficClusters(trafficMap, namespace, gi)
	serviceLists := map[string]*models.ServiceList{}

	for _, cluster := range clusters {
		serviceLists[cluster] = getServiceList(cluster, namespace, gi)
	}

	return serviceLists
}

func getServiceList(cluster, namespace string, gi *GlobalInfo) *models.ServiceList {
	key := graph.GetClusterSensitiveKey(cluster, namespace)
	if serviceList, ok := gi.Vendor.ServiceLists[key]; ok {
		return serviceList
	}

	criteria := business.ServiceCriteria{
		Cluster:                cluster,
		Namespace:              namespace,
		IncludeHealth:          false,
		IncludeOnlyDefinitions: true,
	}
	serviceList, err := gi.Business.Svc.GetServiceList(context.TODO(), criteria)
	graph.CheckError(err)
	gi.Vendor.ServiceLists[key] = serviceList

	return serviceList
}

func getServiceDefinition(cluster, namespace, serviceName string, gi *GlobalInfo) (*models.ServiceOverview, bool) {
	if serviceName == "" || serviceName == graph.Unknown {
		return nil, false
	}
	for _, srv := range getServiceList(cluster, namespace, gi).Services {
		if srv.Name == serviceName {
			return &srv, true
		}
	}
	return nil, false
}

// getServiceEntryHosts returns ServiceEntryHost information cached for a specific cluster and namespace. If not
// previously cached a new, empty cache entry is created and returned.
func getServiceEntryHosts(cluster, namespace string, gi *GlobalInfo) (serviceEntryHosts, bool) {
	key := strings.Join([]string{serviceEntryHostsKey, cluster, namespace}, ":")
	if seHosts, ok := gi.Vendor.ServiceEntryHosts[key]; ok {
		return seHosts, true
	}

	seHosts := newServiceEntryHosts()
	gi.Vendor.ServiceEntryHosts[key] = seHosts

	return seHosts, false
}

// getWorkloadLists returns a map[clusterName]*models.WorkloadList for all clusters with traffic in the namespace, or if trafficMap is nil
// then all clusters on which the namespace is valid.
func getWorkloadLists(trafficMap graph.TrafficMap, namespace string, gi *GlobalInfo) map[string]*models.WorkloadList {
	clusters := getTrafficClusters(trafficMap, namespace, gi)
	workloadLists := map[string]*models.WorkloadList{}

	for _, cluster := range clusters {
		workloadLists[cluster] = getWorkloadList(cluster, namespace, gi)
	}

	return workloadLists
}

func getWorkloadList(cluster, namespace string, gi *GlobalInfo) *models.WorkloadList {
	key := graph.GetClusterSensitiveKey(cluster, namespace)
	if workloadList, ok := gi.Vendor.WorkloadLists[key]; ok {
		return workloadList
	}

	criteria := business.WorkloadCriteria{Cluster: cluster, Namespace: namespace, IncludeIstioResources: false, IncludeHealth: false}
	workloadList, err := gi.Business.Workload.GetWorkloadList(context.TODO(), criteria)
	graph.CheckError(err)
	gi.Vendor.WorkloadLists[key] = &workloadList

	return &workloadList
}

func getWorkload(cluster, namespace, workloadName string, gi *GlobalInfo) (*models.WorkloadListItem, bool) {
	if workloadName == "" || workloadName == graph.Unknown {
		return nil, false
	}

	workloadList := getWorkloadList(cluster, namespace, gi)

	for _, workload := range workloadList.Workloads {
		if workload.Name == workloadName {
			return &workload, true
		}
	}
	return nil, false
}

func getAppWorkloads(cluster, namespace, app, version string, gi *GlobalInfo) []models.WorkloadListItem {
	result := []models.WorkloadListItem{}
	versionOk := graph.IsOKVersion(version)
	for _, workload := range getWorkloadList(cluster, namespace, gi).Workloads {
		appLabelName, appLabelNameFound := gi.Conf.GetAppLabelName(workload.Labels)
		verLabelName, verLabelNameFound := gi.Conf.GetVersionLabelName(workload.Labels)
		if appLabelNameFound && workload.Labels[appLabelName] == app {
			if !versionOk {
				result = append(result, workload)
			} else if verLabelNameFound && workload.Labels[verLabelName] == version {
				result = append(result, workload)
			}
		}
	}
	return result
}

func getApp(namespace, appName string, gi *GlobalInfo) (*models.AppListItem, bool) {
	if appName == "" || appName == graph.Unknown {
		return nil, false
	}

	var namespaceApps appsMap
	if existingNamespaceApps, ok := gi.Vendor.AppsMap[namespace]; ok {
		if app, ok := existingNamespaceApps[appName]; ok {
			return app, true
		} else {
			namespaceApps = existingNamespaceApps
		}
	} else {
		namespaceApps = appsMap{}
		gi.Vendor.AppsMap[namespace] = namespaceApps
	}

	if appList, err := gi.Business.App.GetAppList(context.TODO(), business.AppCriteria{Namespace: namespace, IncludeIstioResources: false, IncludeHealth: false}); err == nil {
		for _, app := range appList.Apps {
			if app.Name == appName {
				namespaceApps[appName] = &app
				return &app, true
			}
		}
	}

	return nil, false
}

// getTrafficClusters returns an array of accessible cluster names for which the TrafficMap has nodes in the given
// namespace. If the trafficMap is nil then return all cluster names for which the namespace exists.
func getTrafficClusters(trafficMap graph.TrafficMap, namespace string, gi *GlobalInfo) []string {
	// get all of the accessible clusters for the given namespace
	namespaceClusters, err := gi.Business.Namespace.GetNamespaceClusters(context.TODO(), namespace)
	graph.CheckError(err)

	clusterNames := sliceutil.Map(namespaceClusters, func(ns models.Namespace) string {
		return ns.Cluster
	})

	if trafficMap == nil {
		return clusterNames
	}

	// reduce to just the set represented in the traffic map
	filteredClusterNames := sliceutil.Filter(clusterNames, func(clusterName string) bool {
		for _, n := range trafficMap {
			if n.Cluster == clusterName {
				return true
			}
		}
		return false
	})

	return filteredClusterNames
}

// PopulateWorkloadMap populates the globalInfo.WorkloadMap with the workloads from the trafficMap.
// TODO: This is only exported for tests to use.
func PopulateWorkloadMap(ctx context.Context, business *business.Layer, globalInfo *GlobalInfo, trafficMap graph.TrafficMap) {
	for _, cluster := range globalInfo.Clusters {
		workloads, err := business.Workload.GetAllWorkloads(ctx, cluster.Name, "")
		if err != nil {
			graph.Error(fmt.Sprintf("Error fetching workloads: %s", err.Error()))
		}

		for _, workload := range workloads {
			globalInfo.Vendor.WorkloadMap[NodeKey{Cluster: workload.Cluster, Namespace: workload.Namespace, Name: workload.Name}] = nil
		}
	}

	for _, node := range trafficMap {
		if _, ok := globalInfo.Vendor.WorkloadMap[NodeKey{Cluster: node.Cluster, Namespace: node.Namespace, Name: node.Workload}]; ok {
			globalInfo.Vendor.WorkloadMap[NodeKey{Cluster: node.Cluster, Namespace: node.Namespace, Name: node.Workload}] = node
		}
	}
}
