package appender

import (
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/log"
)

const WorkloadEntryAppenderName = "workloadEntry"

// WorkloadEntryAppender correlates trafficMap nodes to corresponding WorkloadEntry
// Istio objects. If the trafficMap node has a matching WorkloadEntry, a label is
// added to the node's Metadata. Matching is determined by the "app" and "version"
// labels on both the trafficMap node and the WorkloadEntry object being equivalent.
// A workload can have multiple matches.
type WorkloadEntryAppender struct {
	GraphType string
}

// Name implements Appender
func (a WorkloadEntryAppender) Name() string {
	return WorkloadEntryAppenderName
}

// AppendGraph implements Appender
func (a WorkloadEntryAppender) AppendGraph(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {
	if len(trafficMap) == 0 {
		return
	}

	log.Trace("Running workload entry appender")

	a.applyWorkloadEntries(trafficMap, globalInfo, namespaceInfo)
}

func (a WorkloadEntryAppender) applyWorkloadEntries(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {
	appLabel := config.Get().IstioLabels.AppLabelName
	versionLabel := config.Get().IstioLabels.VersionLabelName

	for _, n := range trafficMap {
		// Only a workload or app node can be a workload entry
		if n.NodeType != graph.NodeTypeWorkload && n.NodeType != graph.NodeTypeApp {
			continue
		}

		istioCfg, err := globalInfo.Business.IstioConfig.GetIstioConfigList(business.IstioConfigCriteria{
			IncludeWorkloadEntries: true,
			Namespace:              n.Namespace,
		})
		graph.CheckError(err)

		log.Tracef("WorkloadEntries found: %d", len(istioCfg.WorkloadEntries))

		for _, entry := range istioCfg.WorkloadEntries {
			if labels, ok := entry.Spec.Labels.(map[string]interface{}); ok {
				if labels[appLabel] == n.App && labels[versionLabel] == n.Version {
					if n.Metadata[graph.HasWorkloadEntry] == nil {
						n.Metadata[graph.HasWorkloadEntry] = []graph.WEInfo{}
					}

					we := graph.WEInfo{Name: entry.Metadata.Name}
					weMetadata := n.Metadata[graph.HasWorkloadEntry].([]graph.WEInfo)
					weMetadata = append(weMetadata, we)
					n.Metadata[graph.HasWorkloadEntry] = weMetadata
					log.Trace("Found matching WorkloadEntry")
				}
			}
		}
	}
}
