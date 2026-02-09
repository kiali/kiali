package get_action_ui

import (
	"context"
	"net/http"
	"slices"
	"strings"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
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

func Execute(r *http.Request, args map[string]interface{}, business *business.Layer, conf *config.Config) (interface{}, int) {
	namespaces := mcputil.GetStringArg(args, "namespaces")
	resourceType := mcputil.GetStringArg(args, "resourceType")
	resourceName := mcputil.GetStringArg(args, "resourceName")
	graph := mcputil.GetStringArg(args, "graph")
	graphType := mcputil.GetStringArg(args, "graphType")
	tab := mcputil.GetStringArg(args, "tab")
	clusterName := mcputil.GetStringArg(args, "clusterName", "clusterName")

	namespacesValue := namespaces
	if namespaces == "all" || namespaces == "" {
		nsList, nsErr := business.Namespace.GetClusterNamespaces(r.Context(), clusterName)
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
	case "istio":
		action, err := getIstioAction(r.Context(), business, clusterName, namespacesValue, resourceName)
		if err != nil {
			log.Warningf("Error getting Istio action: %s", err)
		} else {
			actions = append(actions, action...)
		}
	default:
		// List/Details for workloads, apps and services
		actions = append(actions, getResourceAction(namespacesValue, resourceType, resourceName, tab))
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

func getIstioAction(ctx context.Context, businessLayer *business.Layer, cluster string, namespace string, resourceName string) ([]Action, error) {
	actions := []Action{}
	if resourceName != "" {
		var istioConfig *models.IstioConfigList
		var err error
		if len(strings.Split(namespace, ",")) > 1 {
			// This means that we are listing all Istio configs for all namespaces
			istioConfig, err = businessLayer.IstioConfig.GetIstioConfigList(ctx, cluster, business.ParseIstioConfigCriteria("", "", ""))
		} else {
			// This means that we are listing all Istio configs for a specific namespace
			istioConfig, err = businessLayer.IstioConfig.GetIstioConfigListForNamespace(
				ctx, cluster, namespace, business.ParseIstioConfigCriteria("", "", ""))
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
