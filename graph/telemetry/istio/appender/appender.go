package appender

import (
	"fmt"
	"strconv"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/models"
)

const (
	defaultAggregate = "request_operation"
	defaultQuantile  = 0.95
)

// ParseAppenders determines which appenders should run for this graphing request
func ParseAppenders(o graph.TelemetryOptions) []graph.Appender {

	requestedAppenders := make(map[string]bool)
	if !o.Appenders.All {
		for _, appenderName := range o.Appenders.AppenderNames {
			switch appenderName {
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
	var appenders []graph.Appender

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
	if _, ok := requestedAppenders[ResponseTimeAppenderName]; ok || o.Appenders.All {
		quantile := defaultQuantile
		quantileString := o.Params.Get("responseTimeQuantile")
		if quantileString != "" {
			var err error
			if quantile, err = strconv.ParseFloat(quantileString, 64); err != nil {
				graph.BadRequest(fmt.Sprintf("Invalid quantile, expecting float between 0.0 and 100.0 [%s]", quantileString))
			}
		}
		a := ResponseTimeAppender{
			Quantile:           quantile,
			GraphType:          o.GraphType,
			InjectServiceNodes: o.InjectServiceNodes,
			Namespaces:         o.Namespaces,
			QueryTime:          o.QueryTime,
		}
		appenders = append(appenders, a)
	}
	if _, ok := requestedAppenders[SecurityPolicyAppenderName]; ok || o.Appenders.All {
		a := SecurityPolicyAppender{
			GraphType:          o.GraphType,
			InjectServiceNodes: o.InjectServiceNodes,
			Namespaces:         o.Namespaces,
			QueryTime:          o.QueryTime,
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
		a := IstioAppender{}
		appenders = append(appenders, a)
	}
	if _, ok := requestedAppenders[SidecarsCheckAppenderName]; ok || o.Appenders.All {
		a := SidecarsCheckAppender{}
		appenders = append(appenders, a)
	}

	return appenders
}

const (
	serviceDefinitionListKey = "serviceDefinitionListKey" // namespace vendor info
	serviceEntryHostsKey     = "serviceEntryHosts"        // global vendor info
	workloadListKey          = "workloadList"             // namespace vendor info
)

type serviceEntry struct {
	exportTo  interface{}
	hosts     []string
	location  string
	name      string // serviceEntry name
	namespace string // namespace in which the service entry is defined
}

type serviceEntryHosts map[string][]*serviceEntry

func newServiceEntryHosts() serviceEntryHosts {
	return make(map[string][]*serviceEntry)
}

func (seh serviceEntryHosts) addHost(host string, se *serviceEntry) {
	seArr := []*serviceEntry{se}
	if serviceEntriesForHost, ok := seh[host]; ok {
		// if the same host is defined in multiple service entries, prefer the most
		// specific namespace match when checking for a match...
		if se.exportTo == nil || se.exportTo.([]interface{})[0] == '*' {
			seh[host] = append(serviceEntriesForHost, seArr...)
		} else {
			seh[host] = append(seArr, serviceEntriesForHost...)
		}
	} else {
		seh[host] = seArr
	}
	se.hosts = append(se.hosts, host)
}

func getServiceDefinitionList(ni *graph.AppenderNamespaceInfo) *models.ServiceDefinitionList {
	if sdl, ok := ni.Vendor[serviceDefinitionListKey]; ok {
		return sdl.(*models.ServiceDefinitionList)
	}
	return nil
}

func getService(serviceName string, ni *graph.AppenderNamespaceInfo) (*models.Service, bool) {
	if serviceName == "" || serviceName == graph.Unknown {
		return nil, false
	}
	for _, srv := range getServiceDefinitionList(ni).ServiceDefinitions {
		if srv.Service.Name == serviceName {
			return &srv.Service, true
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

func getWorkloadList(ni *graph.AppenderNamespaceInfo) *models.WorkloadList {
	if wll, ok := ni.Vendor[workloadListKey]; ok {
		return wll.(*models.WorkloadList)
	}
	return nil
}

func getWorkload(workloadName string, ni *graph.AppenderNamespaceInfo) (*models.WorkloadListItem, bool) {
	if workloadName == "" || workloadName == graph.Unknown {
		return nil, false
	}

	for _, workload := range getWorkloadList(ni).Workloads {
		if workload.Name == workloadName {
			return &workload, true
		}
	}
	return nil, false
}

func getAppWorkloads(app, version string, ni *graph.AppenderNamespaceInfo) []models.WorkloadListItem {
	cfg := config.Get()
	appLabel := cfg.IstioLabels.AppLabelName
	versionLabel := cfg.IstioLabels.VersionLabelName

	result := []models.WorkloadListItem{}
	versionOk := graph.IsOK(version)
	for _, workload := range getWorkloadList(ni).Workloads {
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
