package list_or_get_resources

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util"
)

const DefaultRateInterval = "10m"

// ResourceDetailArgs are the optional parameters accepted by the resource detail tool.
type ResourceDetailArgs struct {
	ResourceType string    `json:"resource_type,omitempty"`
	Namespaces   []string  `json:"namespaces,omitempty"`
	ResourceName string    `json:"resource_name,omitempty"`
	ClusterName  string    `json:"cluster_name,omitempty"`
	RateInterval string    `json:"rate_interval,omitempty"`
	QueryTime    time.Time `json:"query_time,omitempty"`
}

func Execute(kialiInterface *mcputil.KialiInterface, args map[string]interface{}) (interface{}, int) {
	// Extract parameters
	resourceType := mcputil.GetStringArg(args, "resource_type", "resourceType")
	namespaces := mcputil.GetStringArg(args, "namespaces")
	resourceName := mcputil.GetStringArg(args, "resource_name", "resourceName")
	clusterName := mcputil.GetStringArg(args, "cluster_name", "clusterName")
	rateInterval := mcputil.GetStringArg(args, "rate_interval", "rateInterval")
	queryTime := mcputil.GetTimeArg(args, "query_time", "queryTime")
	errors := map[string]string{}
	// Validate parameters
	if resourceType == "" {
		return "Resource type is required", http.StatusBadRequest
	}

	if resourceType == "namespace" && resourceName != "" {
		namespaces = resourceName
	}
	if resourceName != "" && namespaces == "" {
		return "Namespaces are required when resource name is provided", http.StatusBadRequest
	}
	if rateInterval == "" {
		rateInterval = DefaultRateInterval
	}
	if queryTime.IsZero() {
		queryTime = util.Clock.Now()
	}
	if clusterName == "" {
		clusterName = kialiInterface.Conf.KubernetesConfig.ClusterName
	}
	var namespacesSlice []string
	if namespaces != "" {
		// Check if accessible namespaces
		invalidNamespaces := []string{}
		for _, ns := range strings.Split(namespaces, ",") {
			_, err := mcputil.CheckNamespaceAccess(kialiInterface.Request, kialiInterface.Conf, kialiInterface.KialiCache, kialiInterface.Discovery, kialiInterface.ClientFactory, ns, clusterName)
			if err != nil {
				invalidNamespaces = append(invalidNamespaces, ns)
				continue
			}
			namespacesSlice = append(namespacesSlice, ns)
		}
		if len(invalidNamespaces) > 0 {
			errors["namespaces"] = fmt.Sprintf("requested namespace(s) not accessible or do not exist (skipped): %s", strings.Join(invalidNamespaces, ", "))
		}
		if len(namespacesSlice) == 0 {
			return map[string]interface{}{
				"errors": errors,
			}, http.StatusOK
		}
	} else {
		allNamespaces, err := kialiInterface.BusinessLayer.Namespace.GetClusterNamespaces(kialiInterface.Request.Context(), clusterName)
		if err != nil {
			return fmt.Sprintf("error fetching namespace list: %s", err.Error()), http.StatusInternalServerError
		}
		namespacesSlice = make([]string, len(allNamespaces))
		for i, ns := range allNamespaces {
			namespacesSlice[i] = ns.Name
		}
	}
	resourceArgs := ResourceDetailArgs{
		ResourceType: resourceType,
		Namespaces:   namespacesSlice,
		ResourceName: resourceName,
		ClusterName:  clusterName,
		RateInterval: rateInterval,
		QueryTime:    queryTime,
	}
	// Get resource details
	var resp interface{}
	var status int
	var err error
	if resourceName != "" && len(namespacesSlice) == 1 {
		log.Debugf("Getting resource details type: %s for resource name: %s and namespace: %s", resourceType, resourceName, namespacesSlice[0])
		resp, status, err = getResourceDetails(kialiInterface.Request.Context(), kialiInterface.BusinessLayer, resourceArgs, namespacesSlice[0])
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
		}, http.StatusOK
	}
	return resp, http.StatusOK
}

func calculateRateInterval(
	ctx context.Context, businessLayer *business.Layer, resourceArgs ResourceDetailArgs, namespace string) (string, int, error) {
	namespaceInfo, err := businessLayer.Namespace.GetClusterNamespace(ctx, namespace, resourceArgs.ClusterName)
	if err != nil {
		return "", http.StatusInternalServerError, fmt.Errorf("error fetching namespace info: %w", err)
	}
	interval, err := util.AdjustRateInterval(namespaceInfo.CreationTimestamp, resourceArgs.QueryTime, resourceArgs.RateInterval)
	if err != nil {
		return "", http.StatusInternalServerError, fmt.Errorf("adjust rate interval error: %w", err)
	}
	return interval, http.StatusOK, nil
}

func getResourceDetails(ctx context.Context, businessLayer *business.Layer, resourceArgs ResourceDetailArgs, namespace string) (interface{}, int, error) {
	istioConfigValidations := models.IstioValidations{}
	var errValidations error

	switch resourceArgs.ResourceType {
	case "service":
		istioConfigValidations, errValidations = businessLayer.Validations.GetValidationsForService(ctx, resourceArgs.ClusterName, namespace, resourceArgs.ResourceName)
	case "workload":
		istioConfigValidations, errValidations = businessLayer.Validations.GetValidationsForWorkload(ctx, resourceArgs.ClusterName, namespace, resourceArgs.ResourceName)
	}

	interval, code, err := calculateRateInterval(ctx, businessLayer, resourceArgs, namespace)
	if code != http.StatusOK {
		return nil, code, err
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
			return nil, http.StatusInternalServerError, fmt.Errorf("error fetching service details: %w", err)
		}
		serviceDetails.Validations = istioConfigValidations.MergeValidations(serviceDetails.Validations)
		err = errValidations
		if err != nil {
			return nil, http.StatusInternalServerError, fmt.Errorf("error fetching service validation: %w", err)
		}
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
			return nil, http.StatusInternalServerError, fmt.Errorf("error fetching workload details: %w", err)
		}
		workloadDetails.Validations = istioConfigValidations
		err = errValidations
		if err != nil {
			return nil, http.StatusInternalServerError, fmt.Errorf("error fetching workload validation: %w", err)
		}
		workloadDetails.Health, err = businessLayer.Health.GetWorkloadHealth(
			ctx, criteria.Namespace, criteria.Cluster, criteria.WorkloadName, criteria.RateInterval, criteria.QueryTime, workloadDetails)
		if err != nil {
			return nil, http.StatusInternalServerError, fmt.Errorf("error fetching workload health: %w", err)
		}
		return TransformWorkloadDetail(workloadDetails), http.StatusOK, nil
	case "app":
		criteria := business.AppCriteria{
			Namespace: namespace, AppName: resourceArgs.ResourceName,
			IncludeIstioResources: true, IncludeHealth: true,
			RateInterval: interval, QueryTime: resourceArgs.QueryTime, Cluster: resourceArgs.ClusterName,
		}
		appDetails, err := businessLayer.App.GetAppDetails(ctx, criteria)
		if err != nil {
			return nil, http.StatusInternalServerError, fmt.Errorf("error fetching app details: %w", err)
		}
		return TransformAppDetail(&appDetails), http.StatusOK, nil
	case "namespace":
		log.Debugf("Getting namespace details for resource name: %s", resourceArgs.ResourceName)
		namespaces, err := businessLayer.Namespace.GetNamespaces(ctx)
		if err != nil {
			return nil, http.StatusInternalServerError, fmt.Errorf("error fetching namespace list: %w", err)
		}
		for _, ns := range namespaces {
			if ns.Name == resourceArgs.ResourceName && ns.Cluster == resourceArgs.ClusterName {
				counts := getNamespaceCounts(ctx, businessLayer, ns.Name, ns.Cluster)
				return TransformNamespaceDetail(&ns, counts), http.StatusOK, nil
			}
		}
		return nil, http.StatusNotFound, fmt.Errorf("namespace %s not found", resourceArgs.ResourceName)
	}

	return nil, http.StatusBadRequest, fmt.Errorf("unsupported resource type %s", resourceArgs.ResourceType)
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
		return nil, http.StatusBadRequest, fmt.Errorf("unsupported resource type %s", resourceArgs.ResourceType)
	}
	for _, ns := range nss {
		interval, code, err := calculateRateInterval(r.Context(), businessLayer, resourceArgs, ns)
		if code != http.StatusOK {
			return nil, code, err
		}
		if serviceCriteria != nil {
			criteria := *serviceCriteria
			criteria.Namespace = ns
			criteria.RateInterval = interval

			serviceList, err := businessLayer.Svc.GetServiceList(r.Context(), criteria)
			if err != nil {
				return nil, http.StatusInternalServerError, err
			}
			clusterServices.Services = append(clusterServices.Services, serviceList.Services...)
			clusterServices.Validations = clusterServices.Validations.MergeValidations(serviceList.Validations)
		} else if workloadCriteria != nil {
			criteria := *workloadCriteria
			criteria.Namespace = ns
			criteria.RateInterval = interval

			workloadList, err := businessLayer.Workload.GetWorkloadList(r.Context(), criteria)
			if err != nil {
				return nil, http.StatusInternalServerError, fmt.Errorf("error fetching workload list: %w", err)
			}
			clusterWorkloads.Workloads = append(clusterWorkloads.Workloads, workloadList.Workloads...)
			clusterWorkloads.Validations = clusterWorkloads.Validations.MergeValidations(workloadList.Validations)
		} else if appCriteria != nil {
			criteria := *appCriteria
			criteria.Namespace = ns
			criteria.RateInterval = interval

			appList, err := businessLayer.App.GetAppList(r.Context(), criteria)
			if err != nil {
				return nil, http.StatusInternalServerError, fmt.Errorf("error fetching app list: %w", err)
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
	return nil, http.StatusBadRequest, fmt.Errorf("unsupported resource type %s", resourceArgs.ResourceType)
}

func GetListNamespaces(r *http.Request, conf *config.Config, kialiCache cache.KialiCache,
	businessLayer *business.Layer, resourceArgs ResourceDetailArgs) (NamespaceListResponse, int, error) {
	clusterNamespaces, err := businessLayer.Namespace.GetNamespaces(r.Context())
	if err != nil {
		return NamespaceListResponse{}, http.StatusInternalServerError, fmt.Errorf("error fetching namespace list: %w", err)
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
		return NamespaceListResponse{}, http.StatusInternalServerError, fmt.Errorf("error fetching health for namespaces: %w", err)
	}

	tls, err := businessLayer.TLS.ClusterWideNSmTLSStatus(r.Context(), filteredNamespaces, resourceArgs.ClusterName)
	if err != nil {
		return NamespaceListResponse{}, http.StatusInternalServerError, fmt.Errorf("error fetching TLS status for namespaces: %w", err)
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
