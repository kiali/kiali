package business

import (
	"context"
	"sort"

	core_v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
)

func waypointTrafficSplitForService(svc *models.Service, ns *models.Namespace) *models.WaypointTrafficSplit {
	if svc == nil {
		return nil
	}
	if svc.Labels != nil {
		if svc.Labels[config.WaypointUseLabel] == config.WaypointNone {
			return nil
		}
		if svc.Labels[config.WaypointUseLabel] != "" {
			return models.ResolveWaypointTrafficSplit(svc.Cluster, svc.Namespace, svc.Labels, svc.Annotations, "service")
		}
	}
	if ns != nil {
		return models.ResolveWaypointTrafficSplit(svc.Cluster, svc.Namespace, ns.Labels, ns.Annotations, "namespace")
	}
	return nil
}

func waypointTrafficSplitForWorkload(ctx context.Context, in *WorkloadService, workload models.Workload) *models.WaypointTrafficSplit {
	capturingWaypoints, found := in.getCapturingWaypoints(ctx, workload, false)
	if !found || len(capturingWaypoints) == 0 {
		return nil
	}
	level := capturingWaypoints[0].Type
	cluster := workload.Cluster
	nsName := workload.Namespace

	userClient, ok := in.userClients[cluster]
	if !ok {
		return nil
	}
	nsModel, nsFound := in.cache.GetNamespace(cluster, userClient.GetCacheKey(), nsName)
	if !nsFound {
		return nil
	}

	switch level {
	case "pod":
		if len(workload.Services) > 0 {
			svc := workload.Services[0]
			return waypointTrafficSplitForService(&models.Service{
				Cluster:     cluster,
				Namespace:   svc.Namespace,
				Name:        svc.Name,
				Labels:      svc.Labels,
				Annotations: svc.Annotations,
			}, &nsModel)
		}
		return models.ResolveWaypointTrafficSplit(cluster, nsName, nsModel.Labels, nsModel.Annotations, "namespace")
	case "service":
		if len(workload.Services) > 0 {
			svc := workload.Services[0]
			return waypointTrafficSplitForService(&models.Service{
				Cluster:     cluster,
				Namespace:   svc.Namespace,
				Name:        svc.Name,
				Labels:      svc.Labels,
				Annotations: svc.Annotations,
			}, &nsModel)
		}
		return models.ResolveWaypointTrafficSplit(cluster, nsName, nsModel.Labels, nsModel.Annotations, "namespace")
	default:
		return models.ResolveWaypointTrafficSplit(cluster, nsName, nsModel.Labels, nsModel.Annotations, "namespace")
	}
}

func gatewayWaypointTrafficSplit(ctx context.Context, in *WorkloadService, cluster, gatewayNamespace, gatewayName string) *models.WaypointTrafficSplit {
	userClient, ok := in.userClients[cluster]
	if !ok {
		return nil
	}
	namespaces, found := in.cache.GetNamespaces(cluster, userClient.GetCacheKey())
	if !found {
		return nil
	}
	nsNames := make([]string, 0, len(namespaces))
	for _, ns := range namespaces {
		nsNames = append(nsNames, ns.Name)
	}
	sort.Strings(nsNames)

	candidates := make([]*models.WaypointTrafficSplit, 0)
	for _, nsName := range nsNames {
		nsModel, nsFound := in.cache.GetNamespace(cluster, userClient.GetCacheKey(), nsName)
		if !nsFound {
			continue
		}
		split := models.GatewayWaypointTrafficSplit(cluster, nsName, gatewayName, nsModel.Labels, nsModel.Annotations)
		if split != nil && models.GatewaySplitReferencesGateway(split, gatewayName, gatewayNamespace) {
			candidates = append(candidates, split)
		}
	}
	if fromServices := in.businessLayer.Svc.GatewayTrafficSplitFromEnrolledServices(ctx, gatewayName, gatewayNamespace, cluster); fromServices != nil {
		candidates = append(candidates, fromServices)
	}
	if picked := models.PickGatewayWaypointTrafficSplit(candidates); picked != nil {
		return picked
	}
	if nsModel, nsFound := in.cache.GetNamespace(cluster, userClient.GetCacheKey(), gatewayNamespace); nsFound {
		return models.GatewayWaypointTrafficSplit(cluster, gatewayNamespace, gatewayName, nsModel.Labels, nsModel.Annotations)
	}
	return nil
}

func (in *WorkloadService) decorateWorkloadWaypointTrafficSplit(ctx context.Context, workload *models.Workload) {
	if workload == nil {
		return
	}
	if workload.IsWaypointWorkload() && workload.WaypointFor() != config.WaypointForNone {
		workload.WaypointTrafficSplit = gatewayWaypointTrafficSplit(ctx, in, workload.Cluster, workload.Namespace, workload.Name)
		return
	}
	if len(workload.WaypointWorkloads) == 0 {
		return
	}
	// Recompute after Services are attached so service-level canary labels/annotations win over namespace.
	waypoints := in.GetWaypoints(ctx)
	workload.WaypointWorkloads = in.getWaypointsForWorkload(ctx, *workload, false, waypoints)
	workload.WaypointTrafficSplit = waypointTrafficSplitForWorkload(ctx, in, *workload)
}

func appendCanaryWaypointRef(workloadsList []models.WorkloadReferenceInfo, split *models.WaypointTrafficSplit, waypoints models.Workloads) []models.WorkloadReferenceInfo {
	if split == nil || split.Canary == nil {
		return workloadsList
	}
	for _, ww := range waypoints {
		if ww.Name == split.Canary.Name && ww.Namespace == split.Canary.Namespace && ww.Cluster == split.Canary.Cluster {
			workloadsList = append(workloadsList, models.WorkloadReferenceInfo{
				Name:         split.Canary.Name,
				Namespace:    split.Canary.Namespace,
				Cluster:      split.Canary.Cluster,
				Type:         ww.WaypointFor(),
				WaypointRole: models.WaypointRoleCanary,
				CanaryWeight: split.CanaryWeight,
				RoleWeight:   split.CanaryWeight,
			})
			break
		}
	}
	return workloadsList
}

// waypointRoleDisplayWeight returns the traffic share (0-100) to show for an enrolled resource role, or 0 when no canary split applies.
func waypointRoleDisplayWeight(role string, resLabels map[string]string, resAnn map[string]string, resNs string, labeledNs []core_v1.Namespace, passedCanaryWeight int) int {
	canaryW := passedCanaryWeight
	if role == models.WaypointRoleCanary {
		if canaryW < 0 {
			canaryW = models.ParseWaypointCanaryWeight(resAnn)
		}
		if canaryW <= 0 {
			for _, ns := range labeledNs {
				if ns.Name == resNs {
					canaryW = models.ParseWaypointCanaryWeight(ns.Annotations)
					break
				}
			}
		}
		if canaryW > 0 {
			return canaryW
		}
		return 0
	}
	for _, ns := range labeledNs {
		if ns.Name == resNs {
			if ns.Labels[config.WaypointCanaryUseLabel] != "" {
				cw := models.ParseWaypointCanaryWeight(ns.Annotations)
				if cw > 0 {
					return 100 - cw
				}
			}
			break
		}
	}
	if resLabels != nil && resLabels[config.WaypointCanaryUseLabel] != "" {
		cw := models.ParseWaypointCanaryWeight(resAnn)
		if cw > 0 {
			return 100 - cw
		}
	}
	return 0
}

func waypointRoleDisplayWeightForNamespaceModel(role string, resLabels, resAnn map[string]string, resNs string, ns *models.Namespace, passedCanaryWeight int) int {
	if ns == nil {
		return waypointRoleDisplayWeight(role, resLabels, resAnn, resNs, nil, passedCanaryWeight)
	}
	kubeNs := core_v1.Namespace{
		ObjectMeta: metav1.ObjectMeta{
			Name:        ns.Name,
			Labels:      ns.Labels,
			Annotations: ns.Annotations,
		},
	}
	return waypointRoleDisplayWeight(role, resLabels, resAnn, resNs, []core_v1.Namespace{kubeNs}, passedCanaryWeight)
}
