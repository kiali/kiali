package list_or_get_resources

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kiali/kiali/models"
)

func TestTransformServiceList_EmptyServices(t *testing.T) {
	cluster := &models.ClusterServices{
		Cluster:     "test-cluster",
		Services:    []models.ServiceOverview{},
		Validations: models.IstioValidations{},
	}

	result := TransformServiceList(cluster)

	assert.Contains(t, result, "test-cluster")
	assert.Nil(t, result["test-cluster"])
}

func TestTransformServiceList_WithServices(t *testing.T) {
	cluster := &models.ClusterServices{
		Cluster: "test-cluster",
		Services: []models.ServiceOverview{
			{
				Name:      "reviews",
				Namespace: "bookinfo",
				Labels:    map[string]string{"app": "reviews", "version": "v1"},
				Health: models.ServiceHealth{
					Status: &models.CalculatedHealthStatus{Status: "Healthy"},
				},
				IstioReferences: []*models.IstioValidationKey{
					{Name: "bookinfo-gw", ObjectGVK: schema.GroupVersionKind{Kind: "Gateway"}},
				},
			},
			{
				Name:      "details",
				Namespace: "bookinfo",
				Labels:    map[string]string{"app": "details"},
				Health: models.ServiceHealth{
					Status: &models.CalculatedHealthStatus{Status: "NA"},
				},
			},
		},
		Validations: models.IstioValidations{},
	}

	result := TransformServiceList(cluster)

	items := result["test-cluster"]
	assert.Len(t, items, 2)
	assert.Equal(t, "reviews", items[0].Name)
	assert.Equal(t, "Healthy", items[0].Health)
	assert.Equal(t, "bookinfo", items[0].Namespace)
	assert.Contains(t, items[0].Details, "bookinfo-gw(GW)")
	assert.Equal(t, "app=reviews, version=v1", items[0].Labels)

	assert.Equal(t, "details", items[1].Name)
	assert.Equal(t, "NA", items[1].Health)
	assert.Equal(t, "", items[1].Type)
}

func TestTransformWorkloadList_WithWorkloads(t *testing.T) {
	cluster := &models.ClusterWorkloads{
		Cluster: "test-cluster",
		Workloads: []models.WorkloadListItem{
			{
				Name:        "details-v1",
				Namespace:   "bookinfo",
				Cluster:     "test-cluster",
				WorkloadGVK: schema.GroupVersionKind{Group: "apps", Version: "v1", Kind: "Deployment"},
				Labels:      map[string]string{"app": "details", "version": "v1"},
				Health: models.WorkloadHealth{
					Status: &models.CalculatedHealthStatus{Status: "Healthy"},
				},
			},
		},
		Validations: models.IstioValidations{},
	}

	result := TransformWorkloadList(cluster)

	items := result["test-cluster"]
	assert.Len(t, items, 1)
	assert.Equal(t, "details-v1", items[0].Name)
	assert.Equal(t, "Deployment", items[0].Type)
	assert.Equal(t, "Healthy", items[0].Health)
	assert.Equal(t, "app=details, version=v1", items[0].Labels)
}

func TestTransformWorkloadList_WithValidationChecks(t *testing.T) {
	cluster := &models.ClusterWorkloads{
		Cluster: "test-cluster",
		Workloads: []models.WorkloadListItem{
			{
				Name:        "jaeger",
				Namespace:   "istio-system",
				WorkloadGVK: schema.GroupVersionKind{Kind: "Deployment"},
				Labels:      map[string]string{"app": "jaeger"},
			},
		},
		Validations: models.IstioValidations{
			models.IstioValidationKey{Name: "jaeger", Namespace: "istio-system"}: &models.IstioValidation{
				Name:  "jaeger",
				Valid: true,
				Checks: []*models.IstioCheck{
					{Message: "Missing Version label", Severity: "warning"},
				},
			},
		},
	}

	result := TransformWorkloadList(cluster)
	items := result["test-cluster"]
	assert.Len(t, items, 1)
	assert.Contains(t, items[0].Details, "Missing Version label (warning)")
	assert.Equal(t, "True", items[0].Configuration)
}

func TestTransformWorkloadList_InvalidValidation(t *testing.T) {
	cluster := &models.ClusterWorkloads{
		Cluster: "test-cluster",
		Workloads: []models.WorkloadListItem{
			{Name: "bad-wl", Namespace: "default", WorkloadGVK: schema.GroupVersionKind{Kind: "Deployment"}},
		},
		Validations: models.IstioValidations{
			models.IstioValidationKey{Name: "bad-wl", Namespace: "default"}: &models.IstioValidation{
				Name:  "bad-wl",
				Valid: false,
				Checks: []*models.IstioCheck{
					{Message: "Something wrong", Severity: "error"},
				},
			},
		},
	}

	result := TransformWorkloadList(cluster)
	items := result["test-cluster"]
	assert.Equal(t, "False", items[0].Configuration)
	assert.Contains(t, items[0].Details, "Something wrong (error)")
}

func TestTransformAppList(t *testing.T) {
	cluster := &models.ClusterApps{
		Cluster: "test-cluster",
		Apps: []models.AppListItem{
			{
				Name:         "productpage",
				Namespace:    "bookinfo",
				Cluster:      "test-cluster",
				IstioSidecar: true,
				Labels:       map[string]string{"app": "productpage", "version": "v1"},
				Health: models.AppHealth{
					Status: &models.CalculatedHealthStatus{Status: "Healthy"},
				},
				IstioReferences: []*models.IstioValidationKey{
					{Name: "bookinfo", ObjectGVK: schema.GroupVersionKind{Kind: "VirtualService"}},
				},
			},
		},
	}

	result := TransformAppList(cluster)

	assert.Equal(t, "test-cluster", result.Cluster)
	assert.Len(t, result.Applications, 1)

	app := result.Applications[0]
	assert.Equal(t, "productpage", app.Name)
	assert.Equal(t, "Healthy", app.Health)
	assert.True(t, app.Istio.Sidecar)
	assert.Equal(t, []string{"v1"}, app.Versions)
	assert.Len(t, app.IstioReferences, 1)
	assert.Equal(t, "VirtualService", app.IstioReferences[0].Kind)
}

func TestTransformServiceDetail(t *testing.T) {
	wlItem := &models.WorkloadListItem{
		Name:        "productpage-v1",
		WorkloadGVK: schema.GroupVersionKind{Kind: "Deployment"},
		Labels:      map[string]string{"app": "productpage", "version": "v1"},
		PodCount:    1,
	}
	sd := &models.ServiceDetails{
		Service: models.Service{
			Name:      "productpage",
			Namespace: "bookinfo",
			Ip:        "10.96.1.1",
			Type:      "ClusterIP",
			Ports:     models.Ports{{Name: "http", Port: 9080, Protocol: "TCP"}},
			Selectors: map[string]string{"app": "productpage"},
		},
		IstioSidecar: true,
		Health: models.ServiceHealth{
			Status: &models.CalculatedHealthStatus{Status: "Healthy"},
			Requests: models.RequestHealth{
				Inbound: map[string]map[string]float64{
					"http": {"200": 2.0},
				},
			},
		},
		NamespaceMTLS: models.MTLSStatus{Status: "MTLS_ENABLED"},
		Endpoints: models.Endpoints{
			{Addresses: models.Addresses{{Name: "productpage-v1-abc", IP: "10.244.0.5"}}},
		},
		Workloads:   models.WorkloadOverviews{wlItem},
		Validations: models.IstioValidations{},
	}

	result := TransformServiceDetail(sd)

	assert.Equal(t, "productpage", result.Service.Name)
	assert.Equal(t, "ClusterIP", result.Service.Type)
	assert.Equal(t, "10.96.1.1", result.Service.IP)
	assert.Len(t, result.Service.Ports, 1)
	assert.Equal(t, "Healthy", result.HealthStatus)
	assert.Equal(t, "100%", result.InboundSuccessRate)
	assert.True(t, result.IstioConfig.HasSidecar)
	assert.Equal(t, "MTLS_ENABLED", result.IstioConfig.MTLSMode)
	assert.Len(t, result.Endpoints, 1)
	assert.Equal(t, "productpage-v1-abc", result.Endpoints[0].PodName)
	assert.Len(t, result.Workloads, 1)
	assert.Equal(t, "productpage-v1", result.Workloads[0].Name)
	assert.Equal(t, "Deployment", result.Workloads[0].Kind)
}

func TestTransformWorkloadDetail(t *testing.T) {
	wl := &models.Workload{
		DesiredReplicas:   1,
		CurrentReplicas:   1,
		AvailableReplicas: 1,
		Pods: models.Pods{
			{
				Name:   "details-v1-abc",
				Status: "Running",
				Containers: []*models.ContainerInfo{
					{Name: "details", IsProxy: false, IsReady: true},
				},
				IstioInitContainers: []*models.ContainerInfo{
					{Name: "istio-init", Image: "istio/proxyv2:1.28.0", IsProxy: true, IsReady: true},
					{Name: "istio-proxy", Image: "istio/proxyv2:1.28.0", IsProxy: true, IsReady: true},
				},
				ProxyStatus: &models.ProxyStatus{CDS: "Synced", EDS: "Synced", LDS: "Synced", RDS: "Synced"},
			},
		},
		Services: []models.ServiceOverview{
			{Name: "details"},
		},
		Validations: models.IstioValidations{
			models.IstioValidationKey{Name: "bookinfo-gw"}: &models.IstioValidation{Name: "bookinfo-gw", Valid: true},
		},
	}
	wl.Name = "details-v1"
	wl.Namespace = "bookinfo"
	wl.Cluster = "test-cluster"
	wl.WorkloadGVK = schema.GroupVersionKind{Kind: "Deployment"}
	wl.Labels = map[string]string{"app": "details", "version": "v1"}
	wl.IstioSidecar = true
	wl.CreatedAt = "2026-03-05T10:00:00Z"
	wl.ServiceAccountNames = []string{"bookinfo-details"}
	wl.Health = models.WorkloadHealth{
		Status: &models.CalculatedHealthStatus{Status: "Healthy"},
		Requests: models.RequestHealth{
			Inbound: map[string]map[string]float64{
				"http": {"200": 2.0},
			},
		},
	}

	result := TransformWorkloadDetail(wl)

	assert.Equal(t, "details-v1", result.Workload.Name)
	assert.Equal(t, "Deployment", result.Workload.Kind)
	assert.Equal(t, "bookinfo-details", result.Workload.ServiceAccount)
	assert.Equal(t, "Healthy", result.Status.Overall)
	assert.Equal(t, int32(1), result.Status.Replicas.Desired)
	assert.Equal(t, int32(1), result.Status.Replicas.Available)
	assert.Equal(t, "100%", result.Status.TrafficSuccessRate.Inbound)
	assert.Equal(t, "Sidecar", result.Istio.Mode)
	assert.Equal(t, "1.28.0", result.Istio.ProxyVersion)
	assert.NotNil(t, result.Istio.SyncStatus)
	assert.Equal(t, "Synced", result.Istio.SyncStatus.CDS)
	assert.Contains(t, result.Istio.Validations, "bookinfo-gw")
	assert.Equal(t, []string{"details"}, result.AssociatedServices)
	assert.Len(t, result.Pods, 1)
	assert.Equal(t, "Running", result.Pods[0].Status)
	assert.Equal(t, []string{"details"}, result.Pods[0].Containers)
	assert.Equal(t, "Ready", result.Pods[0].IstioInit)
	assert.Equal(t, "Ready", result.Pods[0].IstioProxy)
}

func TestTransformAppDetail(t *testing.T) {
	app := &models.App{
		Name:    "productpage",
		Cluster: "test-cluster",
		Namespace: models.Namespace{
			Name:   "bookinfo",
			Labels: map[string]string{"istio-injection": "enabled"},
		},
		ServiceNames: []string{"productpage"},
		Workloads: []models.WorkloadItem{
			{
				WorkloadName:        "productpage-v1",
				WorkloadGVK:         schema.GroupVersionKind{Kind: "Deployment"},
				IstioSidecar:        true,
				Labels:              map[string]string{"version": "v1"},
				ServiceAccountNames: []string{"bookinfo-productpage"},
			},
		},
		Health: models.AppHealth{
			Status: &models.CalculatedHealthStatus{Status: "Healthy"},
		},
	}

	result := TransformAppDetail(app)

	assert.Equal(t, "productpage", result.App)
	assert.Equal(t, "test-cluster", result.Cluster)
	assert.Equal(t, "bookinfo", result.Namespace)
	assert.Equal(t, "Healthy", result.Health)
	assert.Equal(t, "enabled", result.IstioContext.NamespaceInjection)
	assert.Equal(t, []string{"productpage"}, result.Services)
	assert.Len(t, result.Workloads, 1)
	assert.Equal(t, "productpage-v1", result.Workloads[0].Name)
	assert.Equal(t, "v1", result.Workloads[0].Version)
	assert.Equal(t, "bookinfo-productpage", result.Workloads[0].ServiceAccount)
	assert.True(t, result.Workloads[0].IstioSidecar)
}

func TestTransformNamespaceDetail(t *testing.T) {
	ns := &models.Namespace{
		Name:     "bookinfo",
		Cluster:  "test-cluster",
		Labels:   map[string]string{"istio-injection": "enabled", "istio-discovery": "enabled"},
		Revision: "default",
	}
	counts := NamespaceCounts{Apps: 4, Services: 5, Workloads: 7}

	result := TransformNamespaceDetail(ns, counts)

	assert.Equal(t, "bookinfo", result.Namespace)
	assert.Equal(t, "test-cluster", result.Cluster)
	assert.Equal(t, "enabled", result.IstioContext.Injection)
	assert.Equal(t, "enabled", result.IstioContext.Discovery)
	assert.Equal(t, "default", result.IstioContext.Revision)
	assert.Equal(t, 4, result.Counts.Apps)
	assert.Equal(t, 5, result.Counts.Services)
	assert.Equal(t, 7, result.Counts.Workloads)
}

func TestGetIstioInjection(t *testing.T) {
	tests := []struct {
		expected string
		labels   map[string]string
		name     string
	}{
		{name: "nil labels", labels: nil, expected: "disabled"},
		{name: "empty labels", labels: map[string]string{}, expected: "disabled"},
		{name: "injection enabled", labels: map[string]string{"istio-injection": "enabled"}, expected: "enabled"},
		{name: "injection disabled", labels: map[string]string{"istio-injection": "disabled"}, expected: "disabled"},
		{name: "rev label", labels: map[string]string{"istio.io/rev": "canary"}, expected: "enabled"},
		{name: "injection takes precedence", labels: map[string]string{"istio-injection": "disabled", "istio.io/rev": "default"}, expected: "disabled"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, getIstioInjection(tt.labels))
		})
	}
}

func TestLabelsToString(t *testing.T) {
	assert.Equal(t, "None", labelsToString(nil))
	assert.Equal(t, "None", labelsToString(map[string]string{}))
	assert.Equal(t, "app=details", labelsToString(map[string]string{"app": "details"}))
	assert.Equal(t, "app=reviews, version=v1", labelsToString(map[string]string{"version": "v1", "app": "reviews"}))
}

func TestShortKind(t *testing.T) {
	assert.Equal(t, "VS", shortKind("VirtualService"))
	assert.Equal(t, "DR", shortKind("DestinationRule"))
	assert.Equal(t, "GW", shortKind("Gateway"))
	assert.Equal(t, "SE", shortKind("ServiceEntry"))
	assert.Equal(t, "AP", shortKind("AuthorizationPolicy"))
	assert.Equal(t, "UnknownKind", shortKind("UnknownKind"))
}

func TestComputeSuccessRate(t *testing.T) {
	assert.Equal(t, "", computeSuccessRate(nil))
	assert.Equal(t, "", computeSuccessRate(map[string]map[string]float64{}))
	assert.Equal(t, "100%", computeSuccessRate(map[string]map[string]float64{
		"http": {"200": 10.0},
	}))
	assert.Equal(t, "50%", computeSuccessRate(map[string]map[string]float64{
		"http": {"200": 5.0, "500": 5.0},
	}))
	assert.Equal(t, "0%", computeSuccessRate(map[string]map[string]float64{
		"http": {"500": 3.0},
	}))
}

func TestExtractVersions(t *testing.T) {
	assert.Equal(t, []string{}, extractVersions(map[string]string{}))
	assert.Equal(t, []string{}, extractVersions(map[string]string{"app": "test"}))
	assert.Equal(t, []string{"v1"}, extractVersions(map[string]string{"version": "v1"}))
	assert.Equal(t, []string{"v1", "v2", "v3"}, extractVersions(map[string]string{"version": "v1,v2,v3"}))
}

func TestBuildDetails(t *testing.T) {
	assert.Equal(t, "", buildDetails(nil, nil))

	refs := []*models.IstioValidationKey{
		{Name: "bookinfo", ObjectGVK: schema.GroupVersionKind{Kind: "VirtualService"}},
		{Name: "bookinfo-gw", ObjectGVK: schema.GroupVersionKind{Kind: "Gateway"}},
	}
	assert.Equal(t, "bookinfo(VS), bookinfo-gw(GW)", buildDetails(refs, nil))

	checks := []*models.IstioCheck{
		{Message: "Missing label", Severity: "warning"},
	}
	assert.Equal(t, "Missing label (warning)", buildDetails(nil, checks))
	assert.Equal(t, "bookinfo(VS), Missing label (warning)", buildDetails(refs[:1], checks))
}

func TestGetValidationInfo(t *testing.T) {
	validations := models.IstioValidations{
		models.IstioValidationKey{Name: "svc1", Namespace: "ns1"}: &models.IstioValidation{
			Name:  "svc1",
			Valid: true,
			Checks: []*models.IstioCheck{
				{Message: "check1", Severity: "warning"},
			},
		},
		models.IstioValidationKey{Name: "svc2", Namespace: "ns1"}: &models.IstioValidation{
			Name:   "svc2",
			Valid:  false,
			Checks: []*models.IstioCheck{},
		},
	}

	validStr, checks := getValidationInfo("svc1", "ns1", validations)
	assert.Equal(t, "True", validStr)
	assert.Len(t, checks, 1)

	validStr, checks = getValidationInfo("svc2", "ns1", validations)
	assert.Equal(t, "False", validStr)
	assert.Len(t, checks, 0)

	validStr, checks = getValidationInfo("nonexistent", "ns1", validations)
	assert.Equal(t, "True", validStr)
	assert.Nil(t, checks)
}

func TestTransformServiceDetail_NilHealth(t *testing.T) {
	sd := &models.ServiceDetails{
		Service: models.Service{Name: "test", Namespace: "default"},
		Health:  models.ServiceHealth{},
	}

	result := TransformServiceDetail(sd)
	assert.Equal(t, "NA", result.HealthStatus)
	assert.Equal(t, "", result.InboundSuccessRate)
}

func TestTransformWorkloadDetail_AmbientMode(t *testing.T) {
	wl := &models.Workload{Validations: models.IstioValidations{}}
	wl.Name = "test-wl"
	wl.Namespace = "default"
	wl.IsAmbient = true

	result := TransformWorkloadDetail(wl)
	assert.Equal(t, "Ambient", result.Istio.Mode)
}

func TestTransformWorkloadDetail_NoIstio(t *testing.T) {
	wl := &models.Workload{Validations: models.IstioValidations{}}
	wl.Name = "test-wl"
	wl.Namespace = "default"

	result := TransformWorkloadDetail(wl)
	assert.Equal(t, "None", result.Istio.Mode)
	assert.Equal(t, "", result.Istio.ProxyVersion)
	assert.Nil(t, result.Istio.SyncStatus)
}
