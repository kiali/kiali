package appender

import (
	"fmt"
	"strconv"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/status"
)

const (
	defaultAggregate = "request_operation"
	defaultQuantile  = 0.95
)

// version-specific telemetry field names.  Because the istio version can change outside of the kiali pod,
// these values may change and are therefore re-set on every graph request.
var appLabel = "app"
var verLabel = "version"

func setLabels() {
	if status.AreCanonicalMetricsAvailable() {
		appLabel = "canonical_service"
		verLabel = "canonical_revision"
	}
}

// ParseAppenders determines which appenders should run for this graphing request
func ParseAppenders(o graph.TelemetryOptions) []graph.Appender {
	setLabels()

	requestedAppenders := make(map[string]bool)
	if !o.Appenders.All {
		for _, appenderName := range o.Appenders.AppenderNames {
			switch appenderName {
			case AggregateNodeAppenderName:
				requestedAppenders[AggregateNodeAppenderName] = true
			case DeadNodeAppenderName:
				requestedAppenders[DeadNodeAppenderName] = true
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
			case UnusedNodeAppenderName:
				requestedAppenders[UnusedNodeAppenderName] = true
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
	// To reduce processing, next run appenders that don't apply to unused services
	// Add orphan (unused) services
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
	if _, ok := requestedAppenders[AggregateNodeAppenderName]; ok || o.Appenders.All {
		aggregate := o.Params.Get("responseTimeQuantile")
		if aggregate == "" {
			aggregate = defaultAggregate
		}
		a := AggregateNodeAppender{
			Aggregate:          aggregate,
			GraphType:          o.GraphType,
			InjectServiceNodes: o.InjectServiceNodes,
			Namespaces:         o.Namespaces,
			QueryTime:          o.QueryTime,
		}
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
	if _, ok := requestedAppenders[UnusedNodeAppenderName]; ok || o.Appenders.All {
		hasNodeOptions := o.App != "" || o.Workload != "" || o.Service != ""
		a := UnusedNodeAppender{
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
	location string
	name     string // serviceEntry name
}

type serviceEntryHosts map[string]*serviceEntry

func newServiceEntryHosts() serviceEntryHosts {
	return make(map[string]*serviceEntry)
}

func (seh serviceEntryHosts) addHost(host string, se *serviceEntry) {
	if existingSe, ok := seh[host]; ok {
		log.Warningf("Same host [%s] found in ServiceEntry [%s] and [%s]", host, existingSe.name, se.name)
	}
	seh[host] = se
}

func getServiceDefinitionList(ni *graph.AppenderNamespaceInfo) *models.ServiceDefinitionList {
	if sdl, ok := ni.Vendor[serviceDefinitionListKey]; ok {
		return sdl.(*models.ServiceDefinitionList)
	}
	return nil
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
