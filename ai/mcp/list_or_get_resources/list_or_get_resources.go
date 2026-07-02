package list_or_get_resources

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util"
)

const DefaultRateInterval = "10m"

var argoCDApplicationGVR = schema.GroupVersionResource{
	Group:    "argoproj.io",
	Resource: "applications",
	Version:  "v1alpha1",
}

var dynamicClientCache sync.Map // map[clusterName]dynamic.Interface

func getOrCreateDynamicClient(clientFactory kubernetes.ClientFactory, clusterName string) (dynamic.Interface, error) {
	if cached, ok := dynamicClientCache.Load(clusterName); ok {
		return cached.(dynamic.Interface), nil
	}

	saClient := clientFactory.GetSAClient(clusterName)
	if saClient == nil {
		return nil, fmt.Errorf("no SA client available for cluster %q", clusterName)
	}
	restConfig := saClient.ClusterInfo().ClientConfig
	if restConfig == nil {
		return nil, fmt.Errorf("no REST config available for cluster %q", clusterName)
	}
	client, err := dynamic.NewForConfig(restConfig)
	if err != nil {
		return nil, err
	}

	actual, _ := dynamicClientCache.LoadOrStore(clusterName, client)
	return actual.(dynamic.Interface), nil
}

func getArgoCDAppDetail(ctx context.Context, dynClient dynamic.Interface, name, namespace, cluster string) (interface{}, int) {
	result, err := dynClient.Resource(argoCDApplicationGVR).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		if k8serrors.IsNotFound(err) {
			return fmt.Sprintf("ArgoCD Application %q not found in namespace %q.", name, namespace), http.StatusOK
		}
		return classifyError(err, "argoapp", name, namespace), http.StatusOK
	}
	return TransformArgoCDAppDetail(result.Object, cluster), http.StatusOK
}

func listArgoCDApps(ctx context.Context, dynClient dynamic.Interface, namespaces []string, cluster string) (interface{}, int) {
	var allItems []interface{}
	for _, ns := range namespaces {
		result, err := dynClient.Resource(argoCDApplicationGVR).Namespace(ns).List(ctx, metav1.ListOptions{})
		if err != nil {
			if k8serrors.IsForbidden(err) || k8serrors.IsNotFound(err) {
				continue
			}
			log.Warningf("Error listing ArgoCD Applications in namespace %q: %v", ns, err)
			continue
		}
		for i := range result.Items {
			allItems = append(allItems, result.Items[i].Object)
		}
	}
	return TransformArgoCDAppListFromItems(allItems, cluster), http.StatusOK
}

func executeArgoCDApplication(kialiInterface *mcputil.KialiInterface, namespaces, resourceName, clusterName string) (interface{}, int) {
	nsSlice := parseNamespaceCSV(namespaces)

	if len(nsSlice) > 0 {
		saClient := kialiInterface.ClientFactory.GetSAClient(clusterName)
		if saClient != nil {
			valid, invalid := validateNamespacesViaK8s(saClient, nsSlice)
			if len(invalid) > 0 && len(valid) == 0 {
				return fmt.Sprintf("Namespace(s) %s not found or not accessible. Cannot retrieve application resources.", strings.Join(invalid, ", ")), http.StatusOK
			}
			nsSlice = valid
		}
	}

	dynClient, dynErr := getOrCreateDynamicClient(kialiInterface.ClientFactory, clusterName)
	if dynErr != nil {
		return "ArgoCD Application resources could not be queried. " +
			"Please ensure ArgoCD is installed and the Kiali service account has permission to read Application CRDs.", http.StatusOK
	}

	ctx := kialiInterface.Request.Context()

	if resourceName != "" {
		if len(nsSlice) != 1 {
			return "Exactly one namespace is required when getting a specific application by name.", http.StatusOK
		}
		resp, _ := getArgoCDAppDetail(ctx, dynClient, resourceName, nsSlice[0], clusterName)
		return resp, http.StatusOK
	}

	if len(nsSlice) == 0 {
		resp, _ := listArgoCDAppsAllNamespaces(ctx, dynClient, clusterName)
		return resp, http.StatusOK
	}
	resp, _ := listArgoCDApps(ctx, dynClient, nsSlice, clusterName)
	return resp, http.StatusOK
}

func validateNamespacesViaK8s(k8sClient kubernetes.ClientInterface, namespaces []string) (valid, invalid []string) {
	for _, ns := range namespaces {
		_, err := k8sClient.GetNamespace(ns)
		if err != nil {
			invalid = append(invalid, ns)
		} else {
			valid = append(valid, ns)
		}
	}
	return
}

func parseNamespaceCSV(namespaces string) []string {
	if namespaces == "" {
		return nil
	}
	var result []string
	for _, ns := range strings.Split(namespaces, ",") {
		ns = strings.TrimSpace(ns)
		if ns != "" {
			result = append(result, ns)
		}
	}
	return result
}

func listArgoCDAppsAllNamespaces(ctx context.Context, dynClient dynamic.Interface, cluster string) (interface{}, int) {
	result, err := dynClient.Resource(argoCDApplicationGVR).List(ctx, metav1.ListOptions{})
	if err != nil {
		if k8serrors.IsNotFound(err) {
			return "No ArgoCD Application CRD found on this cluster. ArgoCD may not be installed.", http.StatusOK
		}
		if k8serrors.IsForbidden(err) {
			return "Access denied: the Kiali service account does not have permission to list ArgoCD Applications.", http.StatusOK
		}
		log.Warningf("Error listing ArgoCD Applications across all namespaces: %v", err)
		return "Could not list ArgoCD Applications. Check Kiali server logs for details.", http.StatusOK
	}
	var allItems []interface{}
	for i := range result.Items {
		allItems = append(allItems, result.Items[i].Object)
	}
	return TransformArgoCDAppListFromItems(allItems, cluster), http.StatusOK
}

// classifyError returns a clear, human-readable message for the chatbot
// describing why a Kubernetes/Istio API call failed.
func classifyError(err error, resourceType, name, namespace string) string {
	switch {
	case business.IsAccessibleError(err):
		return fmt.Sprintf("Access denied: namespace %q is not accessible to Kiali", namespace)
	case k8serrors.IsNotFound(err):
		return fmt.Sprintf("Resource not found: %s %q in namespace %q does not exist", resourceType, name, namespace)
	case k8serrors.IsForbidden(err):
		return fmt.Sprintf("Access denied: you do not have permission to access %s %q in namespace %q", resourceType, name, namespace)
	case k8serrors.IsBadRequest(err):
		return fmt.Sprintf("Bad request: %s", err.Error())
	default:
		return fmt.Sprintf("error fetching %s details: %s", resourceType, err.Error())
	}
}

func classifyErrorStatus(err error) int {
	switch {
	case business.IsAccessibleError(err), k8serrors.IsForbidden(err), k8serrors.IsUnauthorized(err):
		return http.StatusForbidden
	case k8serrors.IsNotFound(err):
		return http.StatusNotFound
	case k8serrors.IsBadRequest(err):
		return http.StatusBadRequest
	default:
		return http.StatusInternalServerError
	}
}

// recoverFromPanic catches panics from the business layer (e.g. nil pointer
// dereferences when a K8s API call returns nil + error) and converts them into
// a clean error message returned as HTTP 200 so the LLM can relay it to the user.
func recoverFromPanic(res *interface{}, status *int, resourceType, name, namespace string) {
	if r := recover(); r != nil {
		*res = fmt.Sprintf("Internal error while processing %s %q in namespace %q: %v", resourceType, name, namespace, r)
		*status = http.StatusInternalServerError
	}
}

// ResourceDetailArgs are the optional parameters accepted by the resource detail tool.
type ResourceDetailArgs struct {
	ResourceType   string    `json:"resource_type,omitempty"`
	Namespaces     []string  `json:"namespaces,omitempty"`
	ResourceName   string    `json:"resource_name,omitempty"`
	ClusterName    string    `json:"cluster_name,omitempty"`
	RateInterval   string    `json:"rate_interval,omitempty"`
	QueryTime      time.Time `json:"query_time,omitempty"`
	IncludeZtunnel bool      `json:"include_ztunnel,omitempty"`
}

func Execute(kialiInterface *mcputil.KialiInterface, args map[string]interface{}) (interface{}, int) {
	// Extract parameters
	resourceType := mcputil.GetStringArg(args, "resource_type", "resourceType")
	namespaces := mcputil.GetStringArg(args, "namespaces")
	resourceName := mcputil.GetStringArg(args, "resource_name", "resourceName")
	clusterName := mcputil.GetStringOrDefault(args, kialiInterface.Conf.KubernetesConfig.ClusterName, "clusterName")
	rateInterval := mcputil.GetStringOrDefault(args, DefaultRateInterval, "rateInterval")
	queryTime := mcputil.GetTimeArg(args, "query_time", "queryTime")
	errors := map[string]string{}
	// Validate parameters
	if resourceType == "" {
		return "Resource type is required", http.StatusBadRequest
	}

	if resourceType == "namespace" && resourceName != "" {
		namespaces = resourceName
	}
	if clusterName == "" {
		clusterName = kialiInterface.Conf.KubernetesConfig.ClusterName
	}

	// ArgoCD Application CRs often live outside the mesh (e.g. the "argocd"
	// namespace) so we bypass Kiali's mesh-scoped namespace access check and
	// let Kubernetes RBAC on the dynamic client handle authorization.
	if resourceType == "argoapp" {
		return executeArgoCDApplication(kialiInterface, namespaces, resourceName, clusterName)
	}

	if resourceName != "" && namespaces == "" {
		return "Namespaces are required when resource name is provided", http.StatusBadRequest
	}
	if queryTime.IsZero() {
		queryTime = util.Clock.Now()
	}

	var namespacesSlice []string
	if namespaces != "" {
		invalidNamespaces := []string{}
		invalidStatusCode := http.StatusNotFound
		for _, ns := range strings.Split(namespaces, ",") {
			ns = strings.TrimSpace(ns)
			if ns == "" {
				continue
			}
			_, statusCode := mcputil.ValidateNamespaceAccess(kialiInterface.Request.Context(), kialiInterface.BusinessLayer, ns, clusterName)
			if statusCode != http.StatusOK {
				invalidNamespaces = append(invalidNamespaces, ns)
				if statusCode == http.StatusInternalServerError ||
					(statusCode == http.StatusForbidden && invalidStatusCode != http.StatusInternalServerError) {
					invalidStatusCode = statusCode
				}
				continue
			}
			namespacesSlice = append(namespacesSlice, ns)
		}
		if len(invalidNamespaces) > 0 {
			errors["namespaces"] = fmt.Sprintf("namespace(s) not found or not accessible: %s", strings.Join(invalidNamespaces, ", "))
		}
		if len(namespacesSlice) == 0 {
			msg := fmt.Sprintf("Namespace(s) %s not found or not accessible. Cannot retrieve %s resources.", strings.Join(invalidNamespaces, ", "), resourceType)
			if resourceName != "" {
				msg = fmt.Sprintf("Namespace(s) %s not found or not accessible. Cannot retrieve %s %q.", strings.Join(invalidNamespaces, ", "), resourceType, resourceName)
			}
			return msg, invalidStatusCode
		}
	} else {
		allNamespaces, err := kialiInterface.BusinessLayer.Namespace.GetClusterNamespaces(kialiInterface.Request.Context(), clusterName)
		if err != nil {
			return fmt.Sprintf("error fetching namespace list: %s", err.Error()), classifyErrorStatus(err)
		}
		namespacesSlice = make([]string, len(allNamespaces))
		for i, ns := range allNamespaces {
			namespacesSlice[i] = ns.Name
		}
	}

	includeZtunnel := mcputil.GetBoolArg(args, "includeZtunnel")

	resourceArgs := ResourceDetailArgs{
		ResourceType:   resourceType,
		Namespaces:     namespacesSlice,
		ResourceName:   resourceName,
		ClusterName:    clusterName,
		RateInterval:   rateInterval,
		QueryTime:      queryTime,
		IncludeZtunnel: includeZtunnel,
	}
	var resp interface{}
	var status int
	var err error
	if resourceName != "" && len(namespacesSlice) > 1 {
		return "Exactly one namespace is required when resource name is provided", http.StatusBadRequest
	}
	if resourceName != "" && len(namespacesSlice) == 1 {
		log.Debugf("Getting resource details type: %s for resource name: %s and namespace: %s", resourceType, resourceName, namespacesSlice[0])
		resp, status, err = getResourceDetails(kialiInterface.Request.Context(), kialiInterface.BusinessLayer, kialiInterface.KialiCache, resourceArgs, namespacesSlice[0])
		if err != nil {
			return err.Error(), status
		}

	} else {
		log.Debugf("Getting resource list for resource type: %s", resourceArgs.ResourceType)
		resp, status, err = getList(kialiInterface.Request, kialiInterface.Conf, kialiInterface.KialiCache, kialiInterface.BusinessLayer, resourceArgs)
		if err != nil {
			return err.Error(), status
		}
	}
	if len(errors) > 0 {
		return map[string]interface{}{
			"response": resp,
			"errors":   errors,
		}, status
	}
	return resp, status
}

func calculateRateInterval(
	ctx context.Context, businessLayer *business.Layer, resourceArgs ResourceDetailArgs, namespace string) (string, error) {
	namespaceInfo, err := businessLayer.Namespace.GetClusterNamespace(ctx, namespace, resourceArgs.ClusterName)
	if err != nil {
		return "", fmt.Errorf("error fetching namespace info: %w", err)
	}
	interval, err := util.AdjustRateInterval(namespaceInfo.CreationTimestamp, resourceArgs.QueryTime, resourceArgs.RateInterval)
	if err != nil {
		return "", fmt.Errorf("adjust rate interval error: %w", err)
	}
	return interval, nil
}

func getResourceDetails(ctx context.Context, businessLayer *business.Layer, kialiCache cache.KialiCache, resourceArgs ResourceDetailArgs, namespace string) (resp interface{}, status int, err error) {
	defer recoverFromPanic(&resp, &status, resourceArgs.ResourceType, resourceArgs.ResourceName, namespace)

	istioConfigValidations := models.IstioValidations{}

	switch resourceArgs.ResourceType {
	case "service":
		istioConfigValidations, _ = businessLayer.Validations.GetValidationsForService(ctx, resourceArgs.ClusterName, namespace, resourceArgs.ResourceName)
	case "workload":
		istioConfigValidations, _ = businessLayer.Validations.GetValidationsForWorkload(ctx, resourceArgs.ClusterName, namespace, resourceArgs.ResourceName)
	}

	interval, calcErr := calculateRateInterval(ctx, businessLayer, resourceArgs, namespace)
	if calcErr != nil {
		return calcErr.Error(), http.StatusInternalServerError, nil
	}
	switch resourceArgs.ResourceType {
	case "service":
		serviceDetails, err := businessLayer.Svc.GetServiceDetails(
			ctx,
			resourceArgs.ClusterName,
			namespace,
			resourceArgs.ResourceName,
			interval,
			resourceArgs.QueryTime,
			true)
		if err != nil {
			return classifyError(err, "service", resourceArgs.ResourceName, namespace), classifyErrorStatus(err), nil
		}
		serviceDetails.Validations = istioConfigValidations.MergeValidations(serviceDetails.Validations)
		return TransformServiceDetail(serviceDetails), http.StatusOK, nil
	case "workload":
		criteria := business.WorkloadCriteria{
			Namespace: namespace, WorkloadName: resourceArgs.ResourceName,
			WorkloadGVK:           schema.GroupVersionKind{Group: "", Version: "", Kind: "workload"},
			IncludeIstioResources: true, IncludeServices: true, IncludeHealth: true, RateInterval: interval,
			QueryTime: resourceArgs.QueryTime, Cluster: resourceArgs.ClusterName,
		}
		workloadDetails, err := businessLayer.Workload.GetWorkload(ctx, criteria)
		if err != nil {
			return classifyError(err, "workload", resourceArgs.ResourceName, namespace), classifyErrorStatus(err), nil
		}
		workloadDetails.Validations = istioConfigValidations
		workloadDetails.Health, err = businessLayer.Health.GetWorkloadHealth(
			ctx, criteria.Namespace, criteria.Cluster, criteria.WorkloadName, criteria.RateInterval, criteria.QueryTime, workloadDetails)
		if err != nil {
			return classifyError(err, "workload", resourceArgs.ResourceName, namespace), classifyErrorStatus(err), nil
		}

		// Get ztunnel dump if requested and workload is in Ambient mode
		var ztunnelDump *kubernetes.ZtunnelConfigDump
		if resourceArgs.IncludeZtunnel && workloadDetails.IsAmbient && len(workloadDetails.Pods) > 0 {
			// Use the first pod to get the ztunnel dump
			pod := workloadDetails.Pods[0]
			ztunnelDump = kialiCache.GetZtunnelDump(
				criteria.Cluster,
				criteria.Namespace,
				pod.Name,
			)
		}

		// Get waypoint captured services if this workload is a waypoint
		var waypointServices []models.ServiceReferenceInfo
		if workloadDetails.WorkloadListItem.IsWaypoint {
			waypointServices = businessLayer.Svc.ListWaypointServices(
				ctx,
				workloadDetails.Name,
				workloadDetails.Namespace,
				criteria.Cluster,
			)
		}

		return TransformWorkloadDetail(workloadDetails, ztunnelDump, waypointServices), http.StatusOK, nil
	case "app":
		criteria := business.AppCriteria{
			Namespace: namespace, AppName: resourceArgs.ResourceName,
			IncludeIstioResources: true, IncludeHealth: true,
			RateInterval: interval, QueryTime: resourceArgs.QueryTime, Cluster: resourceArgs.ClusterName,
		}
		appDetails, err := businessLayer.App.GetAppDetails(ctx, criteria)
		if err != nil {
			return classifyError(err, "app", resourceArgs.ResourceName, namespace), classifyErrorStatus(err), nil
		}
		return TransformAppDetail(&appDetails), http.StatusOK, nil
	case "namespace":
		log.Debugf("Getting namespace details for resource name: %s", resourceArgs.ResourceName)
		namespaces, err := businessLayer.Namespace.GetNamespaces(ctx)
		if err != nil {
			return classifyError(err, "namespace", resourceArgs.ResourceName, namespace), classifyErrorStatus(err), nil
		}
		for _, ns := range namespaces {
			if ns.Name == resourceArgs.ResourceName && ns.Cluster == resourceArgs.ClusterName {
				counts := getNamespaceCounts(ctx, businessLayer, ns.Name, ns.Cluster)
				return TransformNamespaceDetail(&ns, counts), http.StatusOK, nil
			}
		}
		return fmt.Sprintf("Resource not found: namespace %q does not exist", resourceArgs.ResourceName), http.StatusNotFound, nil
	}

	return fmt.Sprintf("unsupported resource type %s", resourceArgs.ResourceType), http.StatusBadRequest, nil
}

func getNamespaceCounts(ctx context.Context, businessLayer *business.Layer, namespace, cluster string) NamespaceCounts {
	counts := NamespaceCounts{}

	svcList, err := businessLayer.Svc.GetServiceList(ctx, business.ServiceCriteria{
		Cluster:   cluster,
		Namespace: namespace,
	})
	if err == nil && svcList != nil {
		counts.Services = len(svcList.Services)
	}

	wlList, err := businessLayer.Workload.GetWorkloadList(ctx, business.WorkloadCriteria{
		Cluster:   cluster,
		Namespace: namespace,
	})
	if err == nil {
		counts.Workloads = len(wlList.Workloads)
	}

	appList, err := businessLayer.App.GetAppList(ctx, business.AppCriteria{
		Cluster:   cluster,
		Namespace: namespace,
	})
	if err == nil {
		counts.Apps = len(appList.Apps)
	}

	return counts
}

func getList(r *http.Request, conf *config.Config, kialiCache cache.KialiCache, businessLayer *business.Layer, resourceArgs ResourceDetailArgs) (interface{}, int, error) {
	nss := resourceArgs.Namespaces
	var (
		clusterServices  *models.ClusterServices
		clusterWorkloads *models.ClusterWorkloads
		clusterApps      *models.ClusterApps
		serviceCriteria  *business.ServiceCriteria
		workloadCriteria *business.WorkloadCriteria
		appCriteria      *business.AppCriteria
	)

	switch resourceArgs.ResourceType {
	case "service":
		clusterServices = &models.ClusterServices{
			Cluster:     resourceArgs.ClusterName,
			Services:    []models.ServiceOverview{},
			Validations: models.IstioValidations{},
		}
		serviceCriteria = &business.ServiceCriteria{
			Cluster:                resourceArgs.ClusterName,
			Namespace:              "",
			IncludeHealth:          true,
			IncludeIstioResources:  true,
			IncludeOnlyDefinitions: true,
			RateInterval:           resourceArgs.RateInterval,
			QueryTime:              resourceArgs.QueryTime,
		}
	case "workload":
		clusterWorkloads = &models.ClusterWorkloads{
			Cluster:     resourceArgs.ClusterName,
			Workloads:   []models.WorkloadListItem{},
			Validations: models.IstioValidations{},
		}
		workloadCriteria = &business.WorkloadCriteria{
			Cluster:               resourceArgs.ClusterName,
			Namespace:             "",
			IncludeHealth:         true,
			IncludeIstioResources: true,
			RateInterval:          resourceArgs.RateInterval,
			QueryTime:             resourceArgs.QueryTime,
		}
	case "app":
		clusterApps = &models.ClusterApps{
			Cluster: resourceArgs.ClusterName,
			Apps:    []models.AppListItem{},
		}
		appCriteria = &business.AppCriteria{
			Cluster:               resourceArgs.ClusterName,
			Namespace:             "",
			IncludeHealth:         true,
			IncludeIstioResources: true,
			RateInterval:          resourceArgs.RateInterval,
			QueryTime:             resourceArgs.QueryTime,
		}
	case "namespace":
		return GetListNamespaces(r, conf, kialiCache, businessLayer, resourceArgs)
	default:
		return fmt.Sprintf("unsupported resource type %s", resourceArgs.ResourceType), http.StatusBadRequest, nil
	}
	for _, ns := range nss {
		interval, calcErr := calculateRateInterval(r.Context(), businessLayer, resourceArgs, ns)
		if calcErr != nil {
			return calcErr.Error(), http.StatusInternalServerError, nil
		}
		if serviceCriteria != nil {
			criteria := *serviceCriteria
			criteria.Namespace = ns
			criteria.RateInterval = interval

			serviceList, err := businessLayer.Svc.GetServiceList(r.Context(), criteria)
			if err != nil {
				return classifyError(err, "service", "", ns), classifyErrorStatus(err), nil
			}
			clusterServices.Services = append(clusterServices.Services, serviceList.Services...)
			clusterServices.Validations = clusterServices.Validations.MergeValidations(serviceList.Validations)
		} else if workloadCriteria != nil {
			criteria := *workloadCriteria
			criteria.Namespace = ns
			criteria.RateInterval = interval

			workloadList, err := businessLayer.Workload.GetWorkloadList(r.Context(), criteria)
			if err != nil {
				return classifyError(err, "workload", "", ns), classifyErrorStatus(err), nil
			}
			clusterWorkloads.Workloads = append(clusterWorkloads.Workloads, workloadList.Workloads...)
			clusterWorkloads.Validations = clusterWorkloads.Validations.MergeValidations(workloadList.Validations)
		} else if appCriteria != nil {
			criteria := *appCriteria
			criteria.Namespace = ns
			criteria.RateInterval = interval

			appList, err := businessLayer.App.GetAppList(r.Context(), criteria)
			if err != nil {
				return classifyError(err, "app", "", ns), classifyErrorStatus(err), nil
			}
			clusterApps.Apps = append(clusterApps.Apps, appList.Apps...)
		}
	}

	if clusterServices != nil {
		return TransformServiceList(clusterServices), http.StatusOK, nil
	}
	if clusterWorkloads != nil {
		return TransformWorkloadList(clusterWorkloads), http.StatusOK, nil
	}
	if clusterApps != nil {
		return TransformAppList(clusterApps), http.StatusOK, nil
	}
	return fmt.Sprintf("unsupported resource type %s", resourceArgs.ResourceType), http.StatusBadRequest, nil
}

func GetListNamespaces(r *http.Request, conf *config.Config, kialiCache cache.KialiCache,
	businessLayer *business.Layer, resourceArgs ResourceDetailArgs) (interface{}, int, error) {
	clusterNamespaces, err := businessLayer.Namespace.GetNamespaces(r.Context())
	if err != nil {
		return classifyError(err, "namespace", "", ""), classifyErrorStatus(err), nil
	}

	namespacesToInclude := make(map[string]bool)
	if len(resourceArgs.Namespaces) > 0 {
		for _, ns := range resourceArgs.Namespaces {
			namespacesToInclude[ns] = true
		}
	}
	var nsNames []string
	var filteredNamespaces []models.Namespace
	for _, ns := range clusterNamespaces {
		if len(namespacesToInclude) > 0 && !namespacesToInclude[ns.Name] {
			continue
		}
		if resourceArgs.ClusterName != "" && ns.Cluster != resourceArgs.ClusterName {
			continue
		}
		filteredNamespaces = append(filteredNamespaces, ns)
		nsNames = append(nsNames, ns.Name)
	}

	healthTypes := []string{"app", "service", "workload"}

	health, _, err := businessLayer.Health.GetNamespaceHealth(r.Context(), nsNames, resourceArgs.ClusterName, healthTypes, resourceArgs.RateInterval)

	if err != nil {
		return classifyError(err, "namespace", "", ""), classifyErrorStatus(err), nil
	}

	tls, err := businessLayer.TLS.ClusterWideNSmTLSStatus(r.Context(), filteredNamespaces, resourceArgs.ClusterName)
	if err != nil {
		return classifyError(err, "namespace", "", ""), classifyErrorStatus(err), nil
	}

	tlsMap := make(map[string]string)
	for _, t := range tls {
		tlsMap[t.Namespace] = t.Status
	}

	var items []NamespaceListItem
	for _, ns := range filteredNamespaces {
		healthStr := "Unknown"
		if nsHealth, ok := health.NamespaceHealth[ns.Name]; ok && nsHealth != nil {
			healthStr = nsHealth.WorstStatus
		}

		injection := getIstioInjection(ns.Labels)

		item := NamespaceListItem{
			Health:    healthStr,
			Injection: injection,
			Name:      ns.Name,
		}

		if ns.IsControlPlane {
			item.IsControlPlane = true
		}

		if status, ok := tlsMap[ns.Name]; ok && status != "UNSET" {
			item.MTLS = status
		}

		validations, err := businessLayer.Validations.GetValidationsForNamespace(r.Context(), ns.Cluster, ns.Name)
		if err == nil {
			summary := validations.SummarizeValidation(ns.Name, ns.Cluster)
			if summary != nil && summary.ObjectCount > 0 {
				item.Validations = &NamespaceValidationSummary{Objects: summary.ObjectCount}
			}
		}

		counts := getNamespaceCounts(r.Context(), businessLayer, ns.Name, ns.Cluster)
		if counts.Apps > 0 || counts.Services > 0 || counts.Workloads > 0 {
			item.Counts = &counts
		}

		items = append(items, item)
	}

	return NamespaceListResponse{
		Cluster:    resourceArgs.ClusterName,
		Namespaces: items,
	}, http.StatusOK, nil
}
