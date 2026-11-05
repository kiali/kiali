package business

import (
	"context"
	"sort"

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
				CanaryWeight: split.CanaryWeight,
				Cluster:      split.Canary.Cluster,
				Name:         split.Canary.Name,
				Namespace:    split.Canary.Namespace,
				RoleWeight:   &split.CanaryWeight,
				Type:         ww.WaypointFor(),
				WaypointRole: models.WaypointRoleCanary,
			})
			break
		}
	}
	return workloadsList
}

// A nil weight keeps primary-only enrollment distinct from either endpoint of a canary rollout.
func waypointRoleWeight(split *models.WaypointTrafficSplit, role string) *int {
	if split == nil || split.Canary == nil {
		return nil
	}
	if role == models.WaypointRoleCanary {
		return &split.CanaryWeight
	}
	return &split.PrimaryWeight
}

// Enrollment and displayed weights must use the same effective configuration as service details.
func waypointEnrolledServiceRef(service *models.Service, ns *models.Namespace, gatewayName, gatewayNamespace, role string) *models.ServiceReferenceInfo {
	split := waypointTrafficSplitForService(service, ns)
	if split == nil {
		return nil
	}
	binding := &split.Primary
	if role == models.WaypointRoleCanary {
		binding = split.Canary
	}
	if binding == nil || !models.GatewayBindingMatches(*binding, gatewayName, gatewayNamespace) {
		return nil
	}
	ref := &models.ServiceReferenceInfo{
		Cluster:      service.Cluster,
		LabelType:    split.ConfigLevel,
		Name:         service.Name,
		Namespace:    service.Namespace,
		RoleWeight:   waypointRoleWeight(split, role),
		WaypointRole: role,
	}
	if role == models.WaypointRoleCanary {
		ref.CanaryWeight = split.CanaryWeight
	}
	return ref
}
