package appender

import (
	"fmt"
	"strconv"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/models"
)

func ParseAppenders(appenderNames []string, o graph.Options) []graph.Appender {
	requestedAppenders := make(map[string]bool)
	allAppenders := false
	if nil != appenderNames {
		for _, appenderName := range appenderNames {
			switch appenderName {
			case DeadNodeAppenderName:
				requestedAppenders[DeadNodeAppenderName] = true
			case ServiceEntryAppenderName:
				requestedAppenders[ServiceEntryAppenderName] = true
			case IstioAppenderName:
				requestedAppenders[IstioAppenderName] = true
			case ResponseTimeAppenderName:
				requestedAppenders[ResponseTimeAppenderName] = true
			case SecurityPolicyAppenderName:
				requestedAppenders[SecurityPolicyAppenderName] = true
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
	} else {
		allAppenders = true
	}

	// The appender order is important
	// To pre-process service nodes run service_entry appender first
	// To reduce processing, filter dead nodes next
	// To reduce processing, next run appenders that don't apply to unused services
	// Add orphan (unused) services
	// Run remaining appenders
	var appenders []graph.Appender

	if _, ok := requestedAppenders[ServiceEntryAppenderName]; ok || allAppenders {
		a := ServiceEntryAppender{
			AccessibleNamespaces: o.AccessibleNamespaces,
		}
		appenders = append(appenders, a)
	}
	if _, ok := requestedAppenders[DeadNodeAppenderName]; ok || allAppenders {
		a := DeadNodeAppender{}
		appenders = append(appenders, a)
	}
	if _, ok := requestedAppenders[ResponseTimeAppenderName]; ok || allAppenders {
		quantile := DefaultQuantile
		if _, ok := o.Params["responseTimeQuantile"]; ok {
			if responseTimeQuantile, err := strconv.ParseFloat(o.Params.Get("responseTimeQuantile"), 64); err == nil {
				quantile = responseTimeQuantile
			}
		}
		a := ResponseTimeAppender{
			Quantile:           quantile,
			GraphType:          o.GraphType,
			InjectServiceNodes: o.InjectServiceNodes,
			IncludeIstio:       o.IncludeIstio,
			Namespaces:         o.Namespaces,
			QueryTime:          o.QueryTime,
		}
		appenders = append(appenders, a)
	}
	if _, ok := requestedAppenders[SecurityPolicyAppenderName]; ok || allAppenders {
		a := SecurityPolicyAppender{
			GraphType:          o.GraphType,
			IncludeIstio:       o.IncludeIstio,
			InjectServiceNodes: o.InjectServiceNodes,
			Namespaces:         o.Namespaces,
			QueryTime:          o.QueryTime,
		}
		appenders = append(appenders, a)
	}
	if _, ok := requestedAppenders[UnusedNodeAppenderName]; ok || allAppenders {
		hasNodeOptions := o.App != "" || o.Workload != "" || o.Service != ""
		a := UnusedNodeAppender{
			GraphType:   o.GraphType,
			IsNodeGraph: hasNodeOptions,
		}
		appenders = append(appenders, a)
	}
	if _, ok := requestedAppenders[IstioAppenderName]; ok || allAppenders {
		a := IstioAppender{}
		appenders = append(appenders, a)
	}
	if _, ok := requestedAppenders[SidecarsCheckAppenderName]; ok || allAppenders {
		a := SidecarsCheckAppender{}
		appenders = append(appenders, a)
	}

	return appenders
}

const (
	serviceEntriesKey = "serviceEntries" // global vendor info
	workloadListKey   = "workloadList"   // namespace vendor info
)

type serviceEntries map[string]string

func newServiceEntries() serviceEntries {
	return make(map[string]string)
}

func getServiceEntries(gi *graph.AppenderGlobalInfo) (serviceEntries, bool) {
	if se, ok := gi.Vendor[serviceEntriesKey]; ok {
		return se.(serviceEntries), true
	}
	return newServiceEntries(), false
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
