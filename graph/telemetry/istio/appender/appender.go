package appender

import (
	"context"
	"fmt"
	"strconv"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/models"
)

const (
	defaultAggregate      = "request_operation"
	defaultQuantile       = 0.95
	defaultThroughputType = "response"
	defaultWaypoints      = true
)

// ParseAppenders determines which appenders should run for this graphing request
func ParseAppenders(o graph.TelemetryOptions) (appenders []graph.Appender, finalizers []graph.Appender) {
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
			case IstioAppenderName:
				requestedAppenders[IstioAppenderName] = true
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
				requestedAppenders[AmbientAppenderName] = true
			case HealthAppenderName:
				// currently, because health is still calculated in the client, if requesting health
				// we also need to run the healthConfig appender.  Eventually, asking for health will supply
				// the result of a server-side health calculation.
				requestedAppenders[HealthAppenderName] = true
				requestedFinalizers[HealthAppenderName] = true
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
		a := DeadNodeAppender{}
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
		aggregate := o.NodeOptions.Aggregate
		if aggregate == "" {
			if aggregate = o.Params.Get("aggregate"); aggregate == "" {
				aggregate = defaultAggregate
			}
		}
		a := AggregateNodeAppender{
			Aggregate:          aggregate,
			AggregateValue:     o.NodeOptions.AggregateValue,
			GraphType:          o.GraphType,
			InjectServiceNodes: o.InjectServiceNodes,
			Namespaces:         o.Namespaces,
			QueryTime:          o.QueryTime,
			Rates:              o.Rates,
			Service:            o.NodeOptions.Service,
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
	if _, ok := requestedAppenders[IstioAppenderName]; ok || o.Appenders.All {
		a := IstioAppender{
			AccessibleNamespaces: o.AccessibleNamespaces,
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

	// always run the outsider finalizer first, this alloes other finalizers to
	// utilize graph.isInaccessible and graph.isOutside metatdata values.
	finalizers = append(finalizers, &OutsiderAppender{
		AccessibleNamespaces: o.AccessibleNamespaces,
		Namespaces:           o.Namespaces,
	})

	if _, ok := requestedAppenders[AmbientAppenderName]; ok || o.Appenders.All {
		waypoints := defaultWaypoints
		waypointsString := o.Params.Get("waypoints")
		if waypointsString != "" {
			var waypointsErr error
			waypoints, waypointsErr = strconv.ParseBool(waypointsString)
			if waypointsErr != nil {
				graph.BadRequest(fmt.Sprintf("Invalid waypoints param [%s]", waypointsString))
			}
		}
		a := AmbientAppender{
			Waypoints: waypoints,
		}
		appenders = append(appenders, a)
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
	return make(map[string][]*serviceEntry)
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
func getServiceLists(trafficMap graph.TrafficMap, namespace string, gi *graph.AppenderGlobalInfo) map[string]*models.ServiceList {
	clusters := getTrafficClusters(trafficMap, namespace, gi)
	serviceLists := map[string]*models.ServiceList{}

	for _, cluster := range clusters {
		serviceLists[cluster] = getServiceList(cluster, namespace, gi)
	}

	return serviceLists
}

func getServiceList(cluster, namespace string, gi *graph.AppenderGlobalInfo) *models.ServiceList {
	var serviceListMap map[string]*models.ServiceList
	if existingServiceMap, ok := gi.Vendor[serviceListKey]; ok {
		serviceListMap = existingServiceMap.(map[string]*models.ServiceList)
	} else {
		serviceListMap = make(map[string]*models.ServiceList)
		gi.Vendor[serviceListKey] = serviceListMap
	}

	key := graph.GetClusterSensitiveKey(cluster, namespace)
	if serviceList, ok := serviceListMap[key]; ok {
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
	serviceListMap[key] = serviceList

	return serviceList
}

func getServiceDefinition(cluster, namespace, serviceName string, gi *graph.AppenderGlobalInfo) (*models.ServiceOverview, bool) {
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
func getServiceEntryHosts(cluster, namespace string, gi *graph.AppenderGlobalInfo) (serviceEntryHosts, bool) {
	key := fmt.Sprintf("%s:%s:%s", serviceEntryHostsKey, cluster, namespace)
	if seHosts, ok := gi.Vendor[key]; ok {
		return seHosts.(serviceEntryHosts), true
	}

	seHosts := newServiceEntryHosts()
	gi.Vendor[key] = seHosts

	return seHosts, false
}

// getWorkloadLists returns a map[clusterName]*models.WorkloadList for all clusters with traffic in the namespace, or if trafficMap is nil
// then all clusters on which the namespace is valid.
func getWorkloadLists(trafficMap graph.TrafficMap, namespace string, gi *graph.AppenderGlobalInfo) map[string]*models.WorkloadList {
	clusters := getTrafficClusters(trafficMap, namespace, gi)
	workloadLists := map[string]*models.WorkloadList{}

	for _, cluster := range clusters {
		workloadLists[cluster] = getWorkloadList(cluster, namespace, gi)
	}

	return workloadLists
}

func getWorkloadList(cluster, namespace string, gi *graph.AppenderGlobalInfo) *models.WorkloadList {
	var workloadListMap map[string]*models.WorkloadList
	if existingWorkloadListMap, ok := gi.Vendor[workloadListKey]; ok {
		workloadListMap = existingWorkloadListMap.(map[string]*models.WorkloadList)
	} else {
		workloadListMap = make(map[string]*models.WorkloadList)
		gi.Vendor[workloadListKey] = workloadListMap
	}

	key := graph.GetClusterSensitiveKey(cluster, namespace)
	if workloadList, ok := workloadListMap[key]; ok {
		return workloadList
	}

	criteria := business.WorkloadCriteria{Cluster: cluster, Namespace: namespace, IncludeIstioResources: false, IncludeHealth: false}
	workloadList, err := gi.Business.Workload.GetWorkloadList(context.TODO(), criteria)
	graph.CheckError(err)
	workloadListMap[key] = &workloadList

	return &workloadList
}

func getWorkload(cluster, namespace, workloadName string, gi *graph.AppenderGlobalInfo) (*models.WorkloadListItem, bool) {
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

func getAppWorkloads(cluster, namespace, app, version string, gi *graph.AppenderGlobalInfo) []models.WorkloadListItem {
	cfg := config.Get()
	appLabel := cfg.IstioLabels.AppLabelName
	versionLabel := cfg.IstioLabels.VersionLabelName

	result := []models.WorkloadListItem{}
	versionOk := graph.IsOKVersion(version)
	for _, workload := range getWorkloadList(cluster, namespace, gi).Workloads {
		if appVal, ok := workload.Labels[appLabel]; ok && app == appVal {
			if !versionOk {
				result = append(result, workload)
			} else if versionVal, ok := workload.Labels[versionLabel]; ok && version == versionVal {
				result = append(result, workload)
			}
		}
	}
	return result
}

func getApp(namespace, appName string, gi *graph.AppenderGlobalInfo) (*models.AppListItem, bool) {
	if appName == "" || appName == graph.Unknown {
		return nil, false
	}

	var allAppsMap map[string]appsMap
	if existingAllAppsMap, ok := gi.Vendor[appsMapKey]; ok {
		allAppsMap = existingAllAppsMap.(map[string]appsMap)
	} else {
		allAppsMap = make(map[string]appsMap)
		gi.Vendor[appsMapKey] = allAppsMap
	}

	var namespaceApps appsMap
	if existingNamespaceApps, ok := allAppsMap[namespace]; ok {
		if app, ok := existingNamespaceApps[appName]; ok {
			return app, true
		} else {
			namespaceApps = existingNamespaceApps
		}
	} else {
		namespaceApps = appsMap{}
		allAppsMap[namespace] = namespaceApps
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

// getTrafficClusters returns an array of clusters for which the TrafficMap has accessible nodes for the given
// namespace, or of trafficMap is nil then clusters for which the namespace exists.
func getTrafficClusters(trafficMap graph.TrafficMap, namespace string, gi *graph.AppenderGlobalInfo) []string {
	if trafficMap == nil {
		namespaceClusters, err := gi.Business.Namespace.GetNamespaceClusters(context.TODO(), namespace)
		graph.CheckError(err)

		clusters := make([]string, len(namespaceClusters))
		for i, nc := range namespaceClusters {
			clusters[i] = nc.Cluster
		}
		return clusters
	}

	clusterMap := map[string]bool{}

	for _, n := range trafficMap {
		if b, ok := n.Metadata[graph.IsInaccessible]; ok && b.(bool) {
			continue
		}
		if n.Namespace == namespace {
			clusterMap[n.Cluster] = true
		}
	}

	// TODO change to maps.Keys(clusterMap) with Go 1.21
	clusters := make([]string, len(clusterMap))
	i := 0
	for k := range clusterMap {
		clusters[i] = k
		i++
	}
	return clusters
}
