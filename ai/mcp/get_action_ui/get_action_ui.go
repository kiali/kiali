package get_action_ui

import (
	"context"
	"fmt"
	"net/http"
	"slices"
	"strings"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
)

// MeshGraphArgs are the optional parameters accepted by the mesh graph tool.
type MeshGraphArgs struct {
	Namespaces   []string `json:"namespaces,omitempty"`
	RateInterval string   `json:"rateInterval,omitempty"`
	GraphType    string   `json:"graphType,omitempty"`
	ClusterName  string   `json:"clusterName,omitempty"`
}

// GetMeshGraphResponse encapsulates the mesh graph tool response.
type GetActionUIResponse struct {
	Actions []Action `json:"actions,omitempty"`
	Errors  string   `json:"errors,omitempty"`
}

var validResourceTypes = []string{"service", "workload", "app", "istio", "graph", "overview", "namespaces"}

func invalidNamespaces(ctx context.Context, businessLayer *business.Layer, clusterName, rawNamespaces string) []string {
	if rawNamespaces == "" || rawNamespaces == "all" {
		return nil
	}
	invalid := make([]string, 0)
	seen := map[string]struct{}{}
	for _, ns := range strings.Split(rawNamespaces, ",") {
		ns = strings.TrimSpace(ns)
		if ns == "" {
			continue
		}
		if _, ok := seen[ns]; ok {
			continue
		}
		seen[ns] = struct{}{}
		if _, err := businessLayer.Namespace.GetClusterNamespace(ctx, ns, clusterName); err != nil {
			invalid = append(invalid, ns)
		}
	}
	return invalid
}

// validateResourceExists checks that the given resource exists in the namespace
// before generating a navigation link. Returns a non-empty error message when
// either the namespace is inaccessible or the named resource cannot be found.
// All errors are returned as strings (not Go errors) so that the caller can
// relay them to the LLM with HTTP 200.
func validateResourceExists(ctx context.Context, businessLayer *business.Layer, clusterName, namespace, resourceType, resourceName string) (errMsg string) {
	defer func() {
		if r := recover(); r != nil {
			errMsg = fmt.Sprintf("Internal error while validating %s %q in namespace %q: %v", resourceType, resourceName, namespace, r)
		}
	}()

	_, err := businessLayer.Namespace.GetClusterNamespace(ctx, namespace, clusterName)
	if err != nil {
		return fmt.Sprintf("Namespace %q not found or not accessible", namespace)
	}

	switch resourceType {
	case "workload":
		wlList, err := businessLayer.Workload.GetWorkloadList(ctx, business.WorkloadCriteria{
			Cluster:   clusterName,
			Namespace: namespace,
		})
		if err != nil {
			return fmt.Sprintf("Cannot verify workload %q in namespace %q: %s", resourceName, namespace, err.Error())
		}
		for _, wl := range wlList.Workloads {
			if wl.Name == resourceName {
				return ""
			}
		}
		return fmt.Sprintf("Workload %q not found in namespace %q", resourceName, namespace)

	case "app":
		appList, err := businessLayer.App.GetAppList(ctx, business.AppCriteria{
			Cluster:   clusterName,
			Namespace: namespace,
		})
		if err != nil {
			return fmt.Sprintf("Cannot verify application %q in namespace %q: %s", resourceName, namespace, err.Error())
		}
		for _, app := range appList.Apps {
			if app.Name == resourceName {
				return ""
			}
		}
		return fmt.Sprintf("Application %q not found in namespace %q", resourceName, namespace)

	case "service":
		svcList, err := businessLayer.Svc.GetServiceList(ctx, business.ServiceCriteria{
			Cluster:   clusterName,
			Namespace: namespace,
		})
		if err != nil {
			return fmt.Sprintf("Cannot verify service %q in namespace %q: %s", resourceName, namespace, err.Error())
		}
		if svcList != nil {
			for _, svc := range svcList.Services {
				if svc.Name == resourceName {
					return ""
				}
			}
		}
		return fmt.Sprintf("Service %q not found in namespace %q", resourceName, namespace)
	}

	return ""
}

func Execute(kialiInterface *mcputil.KialiInterface, args map[string]interface{}) (interface{}, int) {
	namespaces := mcputil.GetStringArg(args, "namespaces")
	resourceType := mcputil.GetStringArg(args, "resourceType")
	resourceName := mcputil.GetStringArg(args, "resourceName")
	graph := mcputil.GetStringArg(args, "graph")
	graphType := mcputil.GetStringArg(args, "graphType")
	tab := mcputil.GetStringArg(args, "tab")
	clusterName := mcputil.GetStringOrDefault(args, kialiInterface.Conf.KubernetesConfig.ClusterName, "clusterName")

	if resourceType == "" {
		return "resourceType is required. Must be one of: service, workload, app, istio, graph, overview, namespaces", http.StatusBadRequest
	}
	if !slices.Contains(validResourceTypes, resourceType) {
		return "invalid resourceType '" + resourceType + "'. Must be one of: service, workload, app, istio, graph, overview, namespaces", http.StatusBadRequest
	}
	// Validate explicitly provided namespaces before building any action.
	// Keep single-namespace + resource validation behavior unchanged below.
	if resourceName == "" || strings.Contains(namespaces, ",") {
		if invalid := invalidNamespaces(kialiInterface.Request.Context(), kialiInterface.BusinessLayer, clusterName, namespaces); len(invalid) > 0 {
			return GetActionUIResponse{
				Errors: fmt.Sprintf("Namespace(s) %s not found or not accessible. Cannot generate UI actions.", strings.Join(invalid, ", ")),
			}, http.StatusOK
		}
	}

	namespacesValue := namespaces
	if namespaces == "all" || namespaces == "" {
		namespacesValue = ""
		nsList, nsErr := kialiInterface.BusinessLayer.Namespace.GetClusterNamespaces(kialiInterface.Request.Context(), clusterName)
		if nsErr != nil {
			return GetActionUIResponse{
				Errors: nsErr.Error(),
			}, http.StatusInternalServerError
		}
		for _, ns := range nsList {
			namespacesValue += ns.Name + ","
		}
	}

	actions := make([]Action, 0)
	switch resourceType {
	case "graph":
		actions = append(actions, getGraphAction(namespacesValue, graph, graphType))
	case "overview":
		actions = append(actions, getOverviewAction())
	case "namespaces":
		actions = append(actions, getNamespacesAction())
	case "istio":
		action, err := getIstioAction(kialiInterface.Request.Context(), kialiInterface.BusinessLayer, clusterName, namespacesValue, resourceName)
		if err != nil {
			log.Warningf("Error getting Istio action: %s", err)
		} else {
			actions = append(actions, action...)
		}
	default:
		if resourceName != "" {
			if namespaces == "" || namespaces == "all" || strings.Contains(namespaces, ",") {
				return GetActionUIResponse{
					Errors: fmt.Sprintf("A single namespace is required to view %s %q details. Please specify the exact namespace.", resourceType, resourceName),
				}, http.StatusOK
			}
			if errMsg := validateResourceExists(kialiInterface.Request.Context(), kialiInterface.BusinessLayer, clusterName, namespaces, resourceType, resourceName); errMsg != "" {
				return GetActionUIResponse{Errors: errMsg}, http.StatusOK
			}
		}
		nsForAction := namespacesValue
		if resourceName == "" && (namespaces == "" || namespaces == "all") {
			nsForAction = namespaces
		}
		actions = append(actions, getResourceAction(nsForAction, resourceType, resourceName, tab))
	}

	return GetActionUIResponse{
		Actions: actions,
		Errors:  "",
	}, http.StatusOK
}

func getGraphAction(namespaces string, graph string, graphType string) Action {
	if graphType == "" {
		graphType = "versionedApp"
	}
	if graph == "mesh" {
		return Action{
			Title:   "View Mesh Graph",
			Kind:    ActionKindNavigation,
			Payload: "/mesh",
		}
	}
	namespacesLabel := " for :" + namespaces
	if namespaces == "" {
		namespacesLabel = " for all namespaces"
	}
	return Action{
		Title:   "View Traffic Graph" + namespacesLabel,
		Kind:    ActionKindNavigation,
		Payload: "/graph/namespaces?namespaces=" + namespaces + "&graphType=" + graphType,
	}
}

func getOverviewAction() Action {
	return Action{
		Title:   "View Overview",
		Kind:    ActionKindNavigation,
		Payload: "/overview",
	}
}

func getNamespacesAction() Action {
	return Action{
		Title:   "View Namespaces",
		Kind:    ActionKindNavigation,
		Payload: "/namespaces",
	}
}

func getResourceAction(namespaces string, resourceType string, resourceName string, tab string) Action {
	resourceLabel := "services"
	switch resourceType {
	case "workload":
		resourceLabel = "workloads"
	case "app":
		resourceLabel = "applications"
	}
	if resourceName == "" {
		queryNamespaces := "?namespaces=" + namespaces
		if namespaces == "" || namespaces == "all" {
			queryNamespaces = ""
		}
		return Action{
			Title:   "View " + resourceLabel + " List",
			Kind:    ActionKindNavigation,
			Payload: "/" + resourceLabel + queryNamespaces,
		}
	}
	return Action{
		Title:   "View " + resourceType + " Details",
		Kind:    ActionKindNavigation,
		Payload: "/namespaces/" + namespaces + "/" + resourceLabel + "/" + resourceName + "?tab=" + getTabLabel(tab, resourceType),
	}
}

var tabMap = map[string][]string{
	"service":  []string{"info", "traffic", "metrics", "traces"},
	"workload": []string{"info", "traffic", "logs", "in_metrics", "out_metrics", "traces", "envoy"},
	"app":      []string{"info", "traffic", "in_metrics", "out_metrics", "traces"},
}

func getTabLabel(tab string, resourceType string) string {
	tabLabel := "info"
	if slices.Contains(tabMap[resourceType], tab) {
		tabLabel = tab
	}
	if resourceType == "service" && (tab == "in_metrics" || tab == "out_metrics") {
		tabLabel = "metrics"
	}
	return tabLabel
}

func getIstioAction(ctx context.Context, businessLayer *business.Layer, clusterName string, namespace string, resourceName string) ([]Action, error) {
	actions := []Action{}
	if resourceName != "" {
		var istioConfig *models.IstioConfigList
		var err error
		if len(strings.Split(namespace, ",")) > 1 {
			// This means that we are listing all Istio configs for all namespaces
			istioConfig, err = businessLayer.IstioConfig.GetIstioConfigList(ctx, clusterName, business.ParseIstioConfigCriteria("", "", ""))
		} else {
			// This means that we are listing all Istio configs for a specific namespace
			istioConfig, err = businessLayer.IstioConfig.GetIstioConfigListForNamespace(
				ctx, clusterName, namespace, business.ParseIstioConfigCriteria("", "", ""))
		}

		if err != nil {
			return []Action{}, err
		}
		istioObjectsFiltered := filterIstioObjectsByName(istioConfig, resourceName)
		actions = GetActionsForIstioObjects(istioObjectsFiltered)
	} else {
		actions = append(actions, Action{
			Title:   "View Istio List of Configs",
			Kind:    ActionKindNavigation,
			Payload: "/istio" + "?namespaces=" + namespace,
		})
	}

	return actions, nil
}
