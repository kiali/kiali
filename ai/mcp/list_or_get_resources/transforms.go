package list_or_get_resources

import (
	"fmt"
	"sort"
	"strings"

	"github.com/kiali/kiali/models"
)

func TransformServiceList(cluster *models.ClusterServices) map[string][]ResourceListItem {
	var items []ResourceListItem
	for _, svc := range cluster.Services {
		healthStr := "NA"
		if svc.Health.Status != nil {
			healthStr = string(svc.Health.Status.Status)
		}

		validStr, checks := getValidationInfo(svc.Name, svc.Namespace, cluster.Validations)
		details := buildDetails(svc.IstioReferences, checks)

		items = append(items, ResourceListItem{
			Configuration: validStr,
			Details:       details,
			Health:        healthStr,
			Labels:        labelsToString(svc.Labels),
			Name:          svc.Name,
			Namespace:     svc.Namespace,
		})
	}
	return map[string][]ResourceListItem{cluster.Cluster: items}
}

func TransformWorkloadList(cluster *models.ClusterWorkloads) map[string][]ResourceListItem {
	var items []ResourceListItem
	for _, wl := range cluster.Workloads {
		healthStr := "NA"
		if wl.Health.Status != nil {
			healthStr = string(wl.Health.Status.Status)
		}

		validStr, checks := getValidationInfo(wl.Name, wl.Namespace, cluster.Validations)
		details := buildDetails(wl.IstioReferences, checks)

		items = append(items, ResourceListItem{
			Configuration: validStr,
			Details:       details,
			Health:        healthStr,
			Labels:        labelsToString(wl.Labels),
			Name:          wl.Name,
			Namespace:     wl.Namespace,
			Type:          wl.WorkloadGVK.Kind,
		})
	}
	return map[string][]ResourceListItem{cluster.Cluster: items}
}

func TransformAppList(cluster *models.ClusterApps) AppListResponse {
	var items []AppListItem
	for _, app := range cluster.Apps {
		healthStr := "NA"
		if app.Health.Status != nil {
			healthStr = string(app.Health.Status.Status)
		}

		versions := extractVersions(app.Labels)

		var refs []AppIstioReference
		for _, ref := range app.IstioReferences {
			refs = append(refs, AppIstioReference{
				Kind: ref.ObjectGVK.Kind,
				Name: ref.Name,
			})
		}
		if refs == nil {
			refs = []AppIstioReference{}
		}

		items = append(items, AppListItem{
			Health: healthStr,
			Istio: AppIstioStatus{
				Ambient: app.IsAmbient,
				Gateway: app.IsGateway,
				Sidecar: app.IstioSidecar,
			},
			IstioReferences: refs,
			Name:            app.Name,
			Namespace:       app.Namespace,
			Versions:        versions,
		})
	}
	return AppListResponse{
		Applications: items,
		Cluster:      cluster.Cluster,
	}
}

func extractVersions(labels map[string]string) []string {
	if v, ok := labels["version"]; ok && v != "" {
		return strings.Split(v, ",")
	}
	return []string{}
}

func getValidationInfo(name, namespace string, validations models.IstioValidations) (string, []*models.IstioCheck) {
	validStr := "True"
	var checks []*models.IstioCheck
	for k, v := range validations {
		if k.Name == name && k.Namespace == namespace {
			if !v.Valid {
				validStr = "False"
			}
			checks = append(checks, v.Checks...)
		}
	}
	return validStr, checks
}

func buildDetails(refs []*models.IstioValidationKey, checks []*models.IstioCheck) string {
	var parts []string
	for _, ref := range refs {
		parts = append(parts, fmt.Sprintf("%s(%s)", ref.Name, shortKind(ref.ObjectGVK.Kind)))
	}
	for _, check := range checks {
		parts = append(parts, fmt.Sprintf("%s (%s)", check.Message, check.Severity))
	}
	if len(parts) == 0 {
		return ""
	}
	return strings.Join(parts, ", ")
}

func shortKind(kind string) string {
	switch kind {
	case "VirtualService":
		return "VS"
	case "DestinationRule":
		return "DR"
	case "Gateway":
		return "GW"
	case "ServiceEntry":
		return "SE"
	case "Sidecar":
		return "SC"
	case "AuthorizationPolicy":
		return "AP"
	case "PeerAuthentication":
		return "PA"
	case "RequestAuthentication":
		return "RA"
	case "EnvoyFilter":
		return "EF"
	case "WorkloadEntry":
		return "WE"
	case "WorkloadGroup":
		return "WG"
	case "WasmPlugin":
		return "WP"
	case "Telemetry":
		return "T"
	case "K8sGateway":
		return "K8sGW"
	case "K8sHTTPRoute":
		return "K8sHTTP"
	case "K8sGRPCRoute":
		return "K8sGRPC"
	default:
		return kind
	}
}

// --- Detail transforms ---

func TransformServiceDetail(sd *models.ServiceDetails) ServiceDetailResponse {
	healthStr := "NA"
	if sd.Health.Status != nil {
		healthStr = string(sd.Health.Status.Status)
	}

	var ports []PortDetail
	for _, p := range sd.Service.Ports {
		ports = append(ports, PortDetail{Name: p.Name, Port: p.Port, Protocol: p.Protocol})
	}
	if ports == nil {
		ports = []PortDetail{}
	}

	var vsNames []string
	for _, vs := range sd.VirtualServices {
		vsNames = append(vsNames, vs.Name)
	}
	if vsNames == nil {
		vsNames = []string{}
	}

	var drNames []string
	for _, dr := range sd.DestinationRules {
		drNames = append(drNames, dr.Name)
	}
	if drNames == nil {
		drNames = []string{}
	}

	var valNames []string
	for _, v := range sd.Validations {
		if v.Valid {
			valNames = append(valNames, v.Name)
		}
	}
	if valNames == nil {
		valNames = []string{}
	}

	mtlsMode := "UNSET"
	if sd.NamespaceMTLS.Status != "" {
		mtlsMode = sd.NamespaceMTLS.Status
	}

	var workloads []ServiceWorkloadInfo
	for _, wl := range sd.Workloads {
		sa := ""
		if len(wl.ServiceAccountNames) > 0 {
			sa = wl.ServiceAccountNames[0]
		}
		workloads = append(workloads, ServiceWorkloadInfo{
			Kind:           wl.WorkloadGVK.Kind,
			Labels:         wl.Labels,
			Name:           wl.Name,
			PodCount:       wl.PodCount,
			ServiceAccount: sa,
		})
	}
	if workloads == nil {
		workloads = []ServiceWorkloadInfo{}
	}

	var endpoints []EndpointInfo
	for _, ep := range sd.Endpoints {
		for _, addr := range ep.Addresses {
			endpoints = append(endpoints, EndpointInfo{IP: addr.IP, PodName: addr.Name})
		}
	}
	if endpoints == nil {
		endpoints = []EndpointInfo{}
	}

	inboundRate := computeSuccessRate(sd.Health.Requests.Inbound)

	return ServiceDetailResponse{
		Endpoints:          endpoints,
		HealthStatus:       healthStr,
		InboundSuccessRate: inboundRate,
		IstioConfig: ServiceIstioConfig{
			DestinationRules: drNames,
			HasSidecar:       sd.IstioSidecar,
			IsAmbient:        sd.IsAmbient,
			MTLSMode:         mtlsMode,
			Validations:      valNames,
			VirtualServices:  vsNames,
		},
		Service: ServiceInfo{
			IP:        sd.Service.Ip,
			Name:      sd.Service.Name,
			Namespace: sd.Service.Namespace,
			Ports:     ports,
			Selectors: sd.Service.Selectors,
			Type:      sd.Service.Type,
		},
		Workloads: workloads,
	}
}

func TransformWorkloadDetail(wl *models.Workload) WorkloadDetailResponse {
	healthStr := "NA"
	if wl.Health.Status != nil {
		healthStr = string(wl.Health.Status.Status)
	}

	sa := ""
	if len(wl.ServiceAccountNames) > 0 {
		sa = wl.ServiceAccountNames[0]
	}

	istioMode := "None"
	if wl.IstioSidecar {
		istioMode = "Sidecar"
	} else if wl.IsAmbient {
		istioMode = "Ambient"
	}

	proxyVersion := ""
	var syncStatus *SyncStatus
	var pods []PodInfo
	for _, pod := range wl.Pods {
		var containerNames []string
		for _, c := range pod.Containers {
			if !c.IsProxy {
				containerNames = append(containerNames, c.Name)
			}
		}

		initStatus := "None"
		proxyStatus := "None"
		for _, c := range pod.IstioInitContainers {
			if c.IsReady {
				if c.Name == "istio-init" {
					initStatus = "Ready"
				}
				if c.Name == "istio-proxy" {
					proxyStatus = "Ready"
					if proxyVersion == "" {
						parts := strings.Split(c.Image, ":")
						if len(parts) > 1 {
							proxyVersion = parts[len(parts)-1]
						}
					}
				}
			}
		}
		for _, c := range pod.IstioContainers {
			if c.Name == "istio-proxy" {
				if c.IsReady {
					proxyStatus = "Ready"
				}
				if proxyVersion == "" {
					parts := strings.Split(c.Image, ":")
					if len(parts) > 1 {
						proxyVersion = parts[len(parts)-1]
					}
				}
			}
		}

		if pod.ProxyStatus != nil {
			syncStatus = &SyncStatus{
				CDS: pod.ProxyStatus.CDS,
				EDS: pod.ProxyStatus.EDS,
				LDS: pod.ProxyStatus.LDS,
				RDS: pod.ProxyStatus.RDS,
			}
		}

		pods = append(pods, PodInfo{
			Containers: containerNames,
			IstioInit:  initStatus,
			IstioProxy: proxyStatus,
			Name:       pod.Name,
			Status:     pod.Status,
		})
	}
	if pods == nil {
		pods = []PodInfo{}
	}

	var valNames []string
	for _, v := range wl.Validations {
		if v.Valid {
			valNames = append(valNames, v.Name)
		}
	}
	if valNames == nil {
		valNames = []string{}
	}

	var svcNames []string
	for _, s := range wl.Services {
		svcNames = append(svcNames, s.Name)
	}
	if svcNames == nil {
		svcNames = []string{}
	}

	inboundRate := computeSuccessRate(wl.Health.Requests.Inbound)
	outboundRate := computeSuccessRate(wl.Health.Requests.Outbound)

	return WorkloadDetailResponse{
		AssociatedServices: svcNames,
		Istio: WorkloadIstioInfo{
			Mode:         istioMode,
			ProxyVersion: proxyVersion,
			SyncStatus:   syncStatus,
			Validations:  valNames,
		},
		Pods: pods,
		Status: WorkloadStatus{
			Overall: healthStr,
			Replicas: ReplicaStatus{
				Available: wl.AvailableReplicas,
				Current:   wl.CurrentReplicas,
				Desired:   wl.DesiredReplicas,
			},
			TrafficSuccessRate: TrafficSuccessRate{
				Inbound:  inboundRate,
				Outbound: outboundRate,
			},
		},
		Workload: WorkloadInfo{
			CreatedAt:      wl.CreatedAt,
			Kind:           wl.WorkloadGVK.Kind,
			Labels:         wl.Labels,
			Name:           wl.Name,
			Namespace:      wl.Namespace,
			ServiceAccount: sa,
		},
	}
}

func TransformAppDetail(app *models.App) AppDetailResponse {
	healthStr := "NA"
	if app.Health.Status != nil {
		healthStr = string(app.Health.Status.Status)
	}

	injection := getIstioInjection(app.Namespace.Labels)

	var workloads []AppWorkloadInfo
	for _, wl := range app.Workloads {
		version := ""
		if v, ok := wl.Labels["version"]; ok {
			version = v
		}
		sa := ""
		if len(wl.ServiceAccountNames) > 0 {
			sa = wl.ServiceAccountNames[0]
		}
		workloads = append(workloads, AppWorkloadInfo{
			IstioSidecar:   wl.IstioSidecar,
			Kind:           wl.WorkloadGVK.Kind,
			Name:           wl.WorkloadName,
			ServiceAccount: sa,
			Version:        version,
		})
	}
	if workloads == nil {
		workloads = []AppWorkloadInfo{}
	}

	services := app.ServiceNames
	if services == nil {
		services = []string{}
	}

	return AppDetailResponse{
		App:     app.Name,
		Cluster: app.Cluster,
		Health:  healthStr,
		IstioContext: AppIstioContext{
			IsAmbient:          app.IsAmbient,
			NamespaceInjection: injection,
		},
		Namespace: app.Namespace.Name,
		Services:  services,
		Workloads: workloads,
	}
}

func computeSuccessRate(traffic map[string]map[string]float64) string {
	if len(traffic) == 0 {
		return ""
	}
	var total, success float64
	for _, statusCodes := range traffic {
		for code, rate := range statusCodes {
			total += rate
			if strings.HasPrefix(code, "2") {
				success += rate
			}
		}
	}
	if total == 0 {
		return ""
	}
	pct := (success / total) * 100
	return fmt.Sprintf("%.0f%%", pct)
}

func TransformNamespaceDetail(ns *models.Namespace, counts NamespaceCounts) NamespaceDetailResponse {
	injection := getIstioInjection(ns.Labels)

	discovery := ""
	if ns.Labels != nil {
		if val, ok := ns.Labels["istio-discovery"]; ok {
			discovery = val
		}
	}

	revision := ""
	if ns.Revision != "" {
		revision = ns.Revision
	}

	return NamespaceDetailResponse{
		Cluster: ns.Cluster,
		Counts:  counts,
		IstioContext: NamespaceIstioContext{
			Discovery: discovery,
			Injection: injection,
			Revision:  revision,
		},
		Namespace: ns.Name,
	}
}

func getIstioInjection(labels map[string]string) string {
	if labels == nil {
		return "disabled"
	}
	if val, ok := labels["istio-injection"]; ok {
		return val
	}
	if _, ok := labels["istio.io/rev"]; ok {
		return "enabled"
	}
	return "disabled"
}

func labelsToString(labels map[string]string) string {
	if len(labels) == 0 {
		return "None"
	}
	keys := make([]string, 0, len(labels))
	for k := range labels {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	pairs := make([]string, 0, len(labels))
	for _, k := range keys {
		pairs = append(pairs, fmt.Sprintf("%s=%s", k, labels[k]))
	}
	return strings.Join(pairs, ", ")
}
