package get_resource_detail

import (
	"context"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"sync"
	"time"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/perses"
	"github.com/kiali/kiali/prometheus"
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

func Execute(r *http.Request, args map[string]interface{}, businessLayer *business.Layer, prom prometheus.ClientInterface, clientFactory kubernetes.ClientFactory, kialiCache cache.KialiCache, conf *config.Config, grafana *grafana.Service, perses *perses.Service, discovery *istio.Discovery) (interface{}, int) {
	// Extract parameters
	resourceType := mcputil.GetStringArg(args, "resource_type", "resourceType")
	namespaces := mcputil.GetStringArg(args, "namespaces")
	resourceName := mcputil.GetStringArg(args, "resource_name", "resourceName")
	clusterName := mcputil.GetStringArg(args, "cluster_name", "clusterName")
	rateInterval := mcputil.GetStringArg(args, "rate_interval", "rateInterval")
	queryTime := mcputil.GetTimeArg(args, "query_time", "queryTime")
	// Validate parameters
	if resourceType == "" {
		return "Resource type is required", http.StatusBadRequest
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
		clusterName = conf.KubernetesConfig.ClusterName
	}

	resourceArgs := ResourceDetailArgs{
		ResourceType: resourceType,
		Namespaces:   strings.Split(namespaces, ","),
		ResourceName: resourceName,
		ClusterName:  clusterName,
		RateInterval: rateInterval,
		QueryTime:    queryTime,
	}
	// Get resource details
	if resourceName != "" && len(strings.Split(namespaces, ",")) == 1 {
		log.Debugf("Getting resource details for resource name: %s and namespace: %s", resourceName, strings.Split(namespaces, ",")[0])
		resp, status, err := getResourceDetails(r.Context(), businessLayer, resourceArgs, strings.Split(namespaces, ",")[0])
		if status != http.StatusOK {
			return err.Error(), status
		}
		return resp, http.StatusOK
	}
	log.Debugf("Getting resource list for resource type: %s", resourceArgs.ResourceType)
	resp, _, err := getList(r.Context(), businessLayer, resourceArgs)
	if err != nil {
		return err.Error(), http.StatusInternalServerError
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
	wg := sync.WaitGroup{}
	wg.Add(1)
	go func() {
		defer wg.Done()
		switch resourceArgs.ResourceType {
		case "service":
			istioConfigValidations, errValidations = businessLayer.Validations.GetValidationsForService(ctx, resourceArgs.ClusterName, namespace, resourceArgs.ResourceName)
		case "workload":
			istioConfigValidations, errValidations = businessLayer.Validations.GetValidationsForWorkload(ctx, resourceArgs.ClusterName, namespace, resourceArgs.ResourceName)
		}
	}()
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
		wg.Wait()
		serviceDetails.Validations = istioConfigValidations.MergeValidations(serviceDetails.Validations)
		err = errValidations
		if err != nil {
			return nil, http.StatusInternalServerError, fmt.Errorf("error fetching service validation: %w", err)
		}
		return serviceDetails, http.StatusOK, nil
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
		wg.Wait()
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
		return workloadDetails, http.StatusOK, nil
	}
	return nil, http.StatusBadRequest, fmt.Errorf("unsupported resource type %s", resourceArgs.ResourceType)
}

func getList(ctx context.Context, businessLayer *business.Layer, resourceArgs ResourceDetailArgs) (interface{}, int, error) {
	loadedNamespaces, _ := businessLayer.Namespace.GetClusterNamespaces(ctx, resourceArgs.ClusterName)
	namespacesProvided := len(resourceArgs.Namespaces) > 0
	nss := []string{}
	for _, ns := range loadedNamespaces {
		// If namespaces have been provided in the query, further filter the results to only include those namespaces.
		if namespacesProvided {
			if slices.Contains(resourceArgs.Namespaces, ns.Name) {
				nss = append(nss, ns.Name)
			}
		} else {
			// Otherwise no namespaces have been provided in the query params, so include all namespaces the user has access to.
			nss = append(nss, ns.Name)
		}
	}

	var (
		clusterServices  *models.ClusterServices
		clusterWorkloads *models.ClusterWorkloads
		serviceCriteria  *business.ServiceCriteria
		workloadCriteria *business.WorkloadCriteria
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
	default:
		return nil, http.StatusBadRequest, fmt.Errorf("unsupported resource type %s", resourceArgs.ResourceType)
	}

	for _, ns := range nss {
		interval, code, err := calculateRateInterval(ctx, businessLayer, resourceArgs, ns)
		if code != http.StatusOK {
			return nil, code, err
		}
		if serviceCriteria != nil {
			criteria := *serviceCriteria
			criteria.Namespace = ns
			criteria.RateInterval = interval

			serviceList, err := businessLayer.Svc.GetServiceList(ctx, criteria)
			if err != nil {
				return nil, http.StatusInternalServerError, err
			}
			clusterServices.Services = append(clusterServices.Services, serviceList.Services...)
			clusterServices.Validations = clusterServices.Validations.MergeValidations(serviceList.Validations)
		} else if workloadCriteria != nil {
			criteria := *workloadCriteria
			criteria.Namespace = ns
			criteria.RateInterval = interval

			workloadList, err := businessLayer.Workload.GetWorkloadList(ctx, criteria)
			if err != nil {
				return nil, http.StatusInternalServerError, fmt.Errorf("error fetching workload list: %w", err)
			}
			clusterWorkloads.Workloads = append(clusterWorkloads.Workloads, workloadList.Workloads...)
			clusterWorkloads.Validations = clusterWorkloads.Validations.MergeValidations(workloadList.Validations)
		}
	}

	if clusterServices != nil {
		return clusterServices, http.StatusOK, nil
	}
	return clusterWorkloads, http.StatusOK, nil
}
