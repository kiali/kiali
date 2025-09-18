package appender

import (
	"context"

	"github.com/kiali/kiali/business"
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
	AccessibleNamespaces graph.AccessibleNamespaces
}

// Name implements Appender
func (a WorkloadEntryAppender) Name() string {
	return WorkloadEntryAppenderName
}

// IsFinalizer implements Appender
func (a WorkloadEntryAppender) IsFinalizer() bool {
	return false
}

// AppendGraph implements Appender
func (a WorkloadEntryAppender) AppendGraph(ctx context.Context, trafficMap graph.TrafficMap, globalInfo *GlobalInfo, namespaceInfo *AppenderNamespaceInfo) {
	zl := log.FromContext(ctx)

	if len(trafficMap) == 0 {
		return
	}

	zl.Trace().Msg("Running workload entry appender")

	a.applyWorkloadEntries(ctx, trafficMap, globalInfo, namespaceInfo)
}

func (a WorkloadEntryAppender) applyWorkloadEntries(ctx context.Context, trafficMap graph.TrafficMap, gi *GlobalInfo, namespaceInfo *AppenderNamespaceInfo) {
	zl := log.FromContext(ctx)

	for _, n := range trafficMap {
		// Skip the check if this node is outside the requested namespace, we limit badging to the requested namespaces
		if n.Namespace != namespaceInfo.Namespace {
			continue
		}

		// Only a workload or app node can be a workload entry
		if n.NodeType != graph.NodeTypeWorkload && n.NodeType != graph.NodeTypeApp {
			continue
		}

		// Skip if the node is not accesible to the user, because we can't query for the config
		if !a.isAccessible(n.Cluster, n.Namespace) {
			continue
		}

		istioCfg, err := gi.Business.IstioConfig.GetIstioConfigListForNamespace(ctx, n.Cluster, n.Namespace, business.IstioConfigCriteria{
			IncludeWorkloadEntries: true,
		})
		graph.CheckError(err)

		zl.Trace().Msgf("WorkloadEntries found: %d", len(istioCfg.WorkloadEntries))

		for _, entry := range istioCfg.WorkloadEntries {
			appLabelName, appLabelNameFound := gi.Conf.GetAppLabelName(entry.Spec.Labels)
			verLabelName, verLabelNameFound := gi.Conf.GetVersionLabelName(entry.Spec.Labels)
			if appLabelNameFound && verLabelNameFound && entry.Spec.Labels[appLabelName] == n.App && entry.Spec.Labels[verLabelName] == n.Version {
				if n.Metadata[graph.HasWorkloadEntry] == nil {
					n.Metadata[graph.HasWorkloadEntry] = []graph.WEInfo{}
				}

				we := graph.WEInfo{Name: entry.Name}
				weMetadata := n.Metadata[graph.HasWorkloadEntry].([]graph.WEInfo)
				weMetadata = append(weMetadata, we)
				n.Metadata[graph.HasWorkloadEntry] = weMetadata
				zl.Trace().Msg("Found matching WorkloadEntry")
			}
		}
	}
}

// returns true if we have access to the cluster-specific namespace
func (a *WorkloadEntryAppender) isAccessible(cluster, namespace string) bool {
	key := graph.GetClusterSensitiveKey(cluster, namespace)
	_, ok := a.AccessibleNamespaces[key]
	return ok
}
