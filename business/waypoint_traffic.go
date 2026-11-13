package business

import (
	"context"
	"fmt"
	"sort"

	core_v1 "k8s.io/api/core/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type gatewayWaypointSplitCacheKey struct{}

type gatewayWaypointSplitCache struct {
	configs  map[string][]models.GatewayWaypointTrafficSplitConfig
	services map[string][]core_v1.Service
}

// ContextWithGatewayWaypointSplitCache attaches a per-request cache for gateway enrollment splits.
// Reuse the same context (e.g. GetWorkload, mesh map build) to avoid repeated cluster-wide scans.
func ContextWithGatewayWaypointSplitCache(ctx context.Context) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	if _, ok := ctx.Value(gatewayWaypointSplitCacheKey{}).(*gatewayWaypointSplitCache); ok {
		return ctx
	}
	return context.WithValue(ctx, gatewayWaypointSplitCacheKey{}, &gatewayWaypointSplitCache{
		configs:  make(map[string][]models.GatewayWaypointTrafficSplitConfig),
		services: make(map[string][]core_v1.Service),
	})
}

func gatewayWaypointSplitCacheFromContext(ctx context.Context) *gatewayWaypointSplitCache {
	if ctx == nil {
		return nil
	}
	cache, _ := ctx.Value(gatewayWaypointSplitCacheKey{}).(*gatewayWaypointSplitCache)
	return cache
}

func gatewaySplitCacheKey(cluster, gatewayNamespace, gatewayName string) string {
	return fmt.Sprintf("%s\x00%s\x00%s", cluster, gatewayNamespace, gatewayName)
}

// Enrollment already lists inherited Services. Reuse that read-only snapshot for
// annotation-only split discovery and other gateways within the same request.
func waypointNamespaceServices(ctx context.Context, reader client.Reader, cluster, namespace string) ([]core_v1.Service, error) {
	cache := gatewayWaypointSplitCacheFromContext(ctx)
	key := gatewaySplitCacheKey(cluster, namespace, "")
	if cache != nil {
		if services, found := cache.services[key]; found {
			return services, nil
		}
	}
	services := &core_v1.ServiceList{}
	if err := reader.List(ctx, services, client.InNamespace(namespace)); err != nil {
		return []core_v1.Service{}, err
	}
	if cache != nil {
		if cache.services == nil {
			cache.services = make(map[string][]core_v1.Service)
		}
		cache.services[key] = services.Items
	}
	return services.Items, nil
}

func waypointTrafficSplitForService(svc *models.Service, ns *models.Namespace) *models.WaypointTrafficSplit {
	if svc == nil {
		return nil
	}
	var namespaceLabels, namespaceAnnotations map[string]string
	if ns != nil {
		namespaceLabels, namespaceAnnotations = ns.Labels, ns.Annotations
	}
	return models.ResolveServiceWaypointTrafficSplit(svc.Cluster, svc.Namespace, svc.Labels, svc.Annotations, namespaceLabels, namespaceAnnotations)
}

func waypointTrafficSplitForWorkload(ctx context.Context, in *WorkloadService, workload models.Workload) (*models.WaypointTrafficSplit, string) {
	_, service, found := in.getCapturingWaypoints(ctx, workload, false)
	if !found || service == nil {
		return nil, ""
	}
	return waypointTrafficSplitForCapturedWorkload(in, workload, service), service.Name
}

// Callers that already established capture can resolve the split without repeating
// the Service lookup. Other callers must use waypointTrafficSplitForWorkload.
func waypointTrafficSplitForCapturedWorkload(in *WorkloadService, workload models.Workload, service *models.ServiceOverview) *models.WaypointTrafficSplit {
	// Canary splits apply only to Service-addressed traffic. Namespace metadata
	// alone cannot establish a canary relationship for a direct workload.
	if service == nil {
		return nil
	}
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

	return waypointTrafficSplitForService(&models.Service{
		Annotations: service.Annotations,
		Cluster:     cluster,
		Labels:      service.Labels,
		Name:        service.Name,
		Namespace:   service.Namespace,
	}, &nsModel)
}

func gatewayWaypointTrafficSplitConfigs(ctx context.Context, in *WorkloadService, cluster, gatewayNamespace, gatewayName string) []models.GatewayWaypointTrafficSplitConfig {
	key := gatewaySplitCacheKey(cluster, gatewayNamespace, gatewayName)
	if cache := gatewayWaypointSplitCacheFromContext(ctx); cache != nil {
		// Keep compact split results across mesh gateways, but release full
		// Service snapshots after each gateway to bound request memory.
		defer func() { cache.services = nil }()
		if configs, hit := cache.configs[key]; hit {
			return configs
		}
		configs := computeGatewayWaypointTrafficSplitConfigs(ctx, in, cluster, gatewayNamespace, gatewayName)
		cache.configs[key] = configs
		return configs
	}
	return computeGatewayWaypointTrafficSplitConfigs(ctx, in, cluster, gatewayNamespace, gatewayName)
}

func computeGatewayWaypointTrafficSplitConfigs(ctx context.Context, in *WorkloadService, cluster, gatewayNamespace, gatewayName string) []models.GatewayWaypointTrafficSplitConfig {
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

	configs := make([]models.GatewayWaypointTrafficSplitConfig, 0)
	for _, nsName := range nsNames {
		nsModel, nsFound := in.cache.GetNamespace(cluster, userClient.GetCacheKey(), nsName)
		if !nsFound {
			continue
		}
		models.AppendNamespaceGatewaySplitConfig(cluster, gatewayNamespace, gatewayName, nsName, nsModel.Labels, nsModel.Annotations, &configs)
	}
	configs = append(configs, in.businessLayer.Svc.GatewayTrafficSplitConfigsFromEnrolledServices(ctx, gatewayName, gatewayNamespace, cluster)...)
	configs = models.SortGatewayWaypointTrafficSplitConfigs(configs)
	if len(configs) > 0 {
		return configs
	}
	return nil
}

func workloadTrafficSplitConfigs(split *models.WaypointTrafficSplit, namespace, serviceName string) []models.GatewayWaypointTrafficSplitConfig {
	if split == nil {
		return nil
	}
	level := split.ConfigLevel
	if level == "" {
		level = "namespace"
	}
	cfg := models.GatewayWaypointTrafficSplitConfig{
		ConfigLevel: level,
		Namespace:   namespace,
		Split:       split,
	}
	if level == "service" && serviceName != "" {
		cfg.ServiceName = serviceName
	}
	return []models.GatewayWaypointTrafficSplitConfig{cfg}
}

func (in *WorkloadService) decorateWorkloadWaypointTrafficSplit(ctx context.Context, workload *models.Workload) {
	if workload == nil {
		return
	}
	// Gateway waypoint splits are resolved in fetchWorkload; avoid a second cluster-wide scan here.
	if workload.IsWaypointWorkload() && workload.WaypointFor() != config.WaypointForNone {
		return
	}
	if len(workload.WaypointWorkloads) == 0 {
		return
	}
	// Recompute after Services are attached so service-level canary labels/annotations win over namespace.
	waypoints := in.GetWaypoints(ctx)
	workload.WaypointWorkloads = in.getWaypointsForWorkload(ctx, *workload, false, waypoints)
	split, serviceName := waypointTrafficSplitForWorkload(ctx, in, *workload)
	workload.WaypointTrafficSplitConfigs = workloadTrafficSplitConfigs(split, workload.Namespace, serviceName)
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

func waypointPrimaryBindingMatches(resourceLabels map[string]string, resourceNamespace, gatewayName, gatewayNamespace string) bool {
	name := resourceLabels[config.WaypointUseLabel]
	if name == "" || name == config.WaypointNone {
		return false
	}
	namespace := resourceLabels[config.WaypointUseNamespaceLabel]
	if namespace == "" {
		namespace = resourceNamespace
	}
	return name == gatewayName && namespace == gatewayNamespace
}

// Direct Pod/VM traffic inherits only primary bindings; Service overrides and canary shares do not apply.
func waypointEnrolledWorkloadRef(workload *models.Workload, ns *models.Namespace, gatewayName, gatewayNamespace string) *models.WorkloadReferenceInfo {
	labelSets := []map[string]string{workload.TemplateLabels}
	if workload.WorkloadGVK.Kind == kubernetes.PodType || workload.WorkloadGVK == kubernetes.WorkloadGroups {
		labelSets[0] = workload.Labels
	}
	if len(workload.Pods) > 0 {
		labelSets = nil
		for _, pod := range workload.Pods {
			labelSets = append(labelSets, pod.Labels)
		}
	}

	labelType := ""
	for _, labels := range labelSets {
		if labels[config.IstioAmbientNamespaceLabel] == "none" {
			continue
		}
		if _, explicit := labels[config.WaypointUseLabel]; explicit {
			if waypointPrimaryBindingMatches(labels, workload.Namespace, gatewayName, gatewayNamespace) {
				labelType = "workload"
				break
			}
		} else if waypointPrimaryBindingMatches(ns.Labels, workload.Namespace, gatewayName, gatewayNamespace) {
			labelType = "namespace"
		}
	}
	if labelType == "" {
		return nil
	}
	return &models.WorkloadReferenceInfo{
		Cluster:      workload.Cluster,
		LabelType:    labelType,
		Labels:       workload.Labels,
		Name:         workload.Name,
		Namespace:    workload.Namespace,
		WaypointRole: models.WaypointRolePrimary,
	}
}
