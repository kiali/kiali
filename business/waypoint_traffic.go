package business

import (
	"context"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
)

func waypointTrafficSplitForService(svc *models.Service, ns *models.Namespace) *models.WaypointTrafficSplit {
	if svc == nil {
		return nil
	}
	if svc.Labels != nil && svc.Labels[config.WaypointUseLabel] != "" && svc.Labels[config.WaypointUseLabel] != config.WaypointNone {
		return models.ResolveWaypointTrafficSplit(svc.Cluster, svc.Namespace, svc.Labels, svc.Annotations, "service")
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
	for _, ns := range namespaces {
		if split := models.GatewayWaypointTrafficSplit(cluster, ns.Name, gatewayName, ns.Labels, ns.Annotations); split != nil {
			if split.Primary.Name == gatewayName && split.Primary.Namespace == gatewayNamespace {
				return split
			}
			if split.Canary != nil && split.Canary.Name == gatewayName && split.Canary.Namespace == gatewayNamespace {
				return split
			}
		}
	}
	// Same namespace as gateway is the common case.
	if nsModel, nsFound := in.cache.GetNamespace(cluster, userClient.GetCacheKey(), gatewayNamespace); nsFound {
		return models.GatewayWaypointTrafficSplit(cluster, gatewayNamespace, gatewayName, nsModel.Labels, nsModel.Annotations)
	}
	return nil
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
			})
			break
		}
	}
	return workloadsList
}
