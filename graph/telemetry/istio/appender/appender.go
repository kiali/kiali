package appender

import (
	"context"
	"fmt"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/models"
)

const (
	defaultAggregate      = "request_operation"
	defaultQuantile       = 0.95
	defaultThroughputType = "response"
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
			case HealthConfigAppenderName:
				requestedAppenders[HealthConfigAppenderName] = true
			case IdleNodeAppenderName:
				requestedAppenders[IdleNodeAppenderName] = true
			case IstioAppenderName:
				requestedAppenders[IstioAppenderName] = true
			case ResponseTimeAppenderName:
				requestedAppenders[ResponseTimeAppenderName] = true
			case SecurityPolicyAppenderName:
				requestedAppenders[SecurityPolicyAppenderName] = true
			case ServiceEntryAppenderName:
				requestedAppenders[ServiceEntryAppenderName] = true
			case SidecarsCheckAppenderName:
				requestedAppenders[SidecarsCheckAppenderName] = true
			case ThroughputAppenderName:
				requestedAppenders[ThroughputAppenderName] = true
			case WorkloadEntryAppenderName:
				requestedAppenders[WorkloadEntryAppenderName] = true
			// finalizer appenders
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
			GraphType: o.GraphType,
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
	if _, ok := requestedAppenders[HealthConfigAppenderName]; ok || o.Appenders.All {
		a := HealthConfigAppender{}
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
	if _, ok := requestedAppenders[SidecarsCheckAppenderName]; ok || o.Appenders.All {
		a := SidecarsCheckAppender{
			AccessibleNamespaces: o.AccessibleNamespaces,
		}
		appenders = append(appenders, a)
	}

	// The finalizer order is important
	// always run the outsider finalizer
	finalizers = append(finalizers, &OutsiderAppender{
		AccessibleNamespaces: o.AccessibleNamespaces,
		Namespaces:           o.Namespaces,
	})

	// if labeler finalizer is to be run, do it after the outsider finalizer
	if _, ok := requestedFinalizers[LabelerAppenderName]; ok {
		finalizers = append(finalizers, &LabelerAppender{})
	}

	// always run the traffic generator finalizer
	finalizers = append(finalizers, &TrafficGeneratorAppender{})

	return appenders, finalizers
}

const (
	serviceListKey       = "serviceListKey"       // global vendor info map[namespace]serviceDefinitionList
	serviceEntryHostsKey = "serviceEntryHostsKey" // global vendor info service entries for all accessible namespaces
	workloadListKey      = "workloadListKey"      // global vendor info map[namespace]workloadListKey
	appsMapKey           = "appsMapKey"           // global vendor info map[namespace]appsMap
)

type serviceEntry struct {
	exportTo  []string
	hosts     []string
	location  string
	name      string // serviceEntry name
	namespace string // namespace in which the service entry is defined
}

type serviceEntryHosts map[string][]*serviceEntry

type appsMap map[string]*models.App

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

func getServiceList(namespace string, gi *graph.AppenderGlobalInfo) *models.ServiceList {
	var serviceListMap map[string]*models.ServiceList
	if existingServiceMap, ok := gi.Vendor[serviceListKey]; ok {
		serviceListMap = existingServiceMap.(map[string]*models.ServiceList)
	} else {
		serviceListMap = make(map[string]*models.ServiceList)
		gi.Vendor[serviceListKey] = serviceListMap
	}

	if serviceList, ok := serviceListMap[namespace]; ok {
		return serviceList
	}

	criteria := business.ServiceCriteria{
		Namespace:              namespace,
		IncludeOnlyDefinitions: true,
	}
	serviceList, err := gi.Business.Svc.GetServiceList(context.TODO(), criteria)
	graph.CheckError(err)
	serviceListMap[namespace] = serviceList

	return serviceList
}

func getServiceDefinition(namespace, serviceName string, gi *graph.AppenderGlobalInfo) (*models.ServiceOverview, bool) {
	if serviceName == "" || serviceName == graph.Unknown {
		return nil, false
	}
	for _, srv := range getServiceList(namespace, gi).Services {
		if srv.Name == serviceName {
			return &srv, true
		}
	}
	return nil, false
}

func getServiceEntryHosts(gi *graph.AppenderGlobalInfo) (serviceEntryHosts, bool) {
	if seHosts, ok := gi.Vendor[serviceEntryHostsKey]; ok {
		return seHosts.(serviceEntryHosts), true
	}
	return newServiceEntryHosts(), false
}

func getWorkloadList(namespace string, gi *graph.AppenderGlobalInfo) *models.WorkloadList {
	var workloadListMap map[string]*models.WorkloadList
	if existingWorkloadMap, ok := gi.Vendor[workloadListKey]; ok {
		workloadListMap = existingWorkloadMap.(map[string]*models.WorkloadList)
	} else {
		workloadListMap = make(map[string]*models.WorkloadList)
		gi.Vendor[workloadListKey] = workloadListMap
	}

	if workloadList, ok := workloadListMap[namespace]; ok {
		return workloadList
	}

	criteria := business.WorkloadCriteria{Namespace: namespace, IncludeIstioResources: false}
	workloadList, err := gi.Business.Workload.GetWorkloadList(context.TODO(), criteria)
	graph.CheckError(err)
	workloadListMap[namespace] = &workloadList

	return &workloadList
}

func getWorkload(namespace, workloadName string, gi *graph.AppenderGlobalInfo) (*models.WorkloadListItem, bool) {
	if workloadName == "" || workloadName == graph.Unknown {
		return nil, false
	}

	workloadList := getWorkloadList(namespace, gi)

	for _, workload := range workloadList.Workloads {
		if workload.Name == workloadName {
			return &workload, true
		}
	}
	return nil, false
}

func getAppWorkloads(namespace, app, version string, gi *graph.AppenderGlobalInfo) []models.WorkloadListItem {
	cfg := config.Get()
	appLabel := cfg.IstioLabels.AppLabelName
	versionLabel := cfg.IstioLabels.VersionLabelName

	result := []models.WorkloadListItem{}
	versionOk := graph.IsOKVersion(version)
	for _, workload := range getWorkloadList(namespace, gi).Workloads {
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

func getApp(namespace, appName string, gi *graph.AppenderGlobalInfo) (*models.App, bool) {
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

	if app, err := gi.Business.App.GetApp(context.TODO(), namespace, appName); err == nil {
		namespaceApps[appName] = &app
		return &app, true
	} else {
		return nil, false
	}
}
