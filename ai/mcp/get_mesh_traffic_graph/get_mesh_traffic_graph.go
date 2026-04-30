package get_mesh_traffic_graph

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	graphApi "github.com/kiali/kiali/graph/api"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/mesh"
	meshApi "github.com/kiali/kiali/mesh/api"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/util"
)

var validGraphTypes = map[string]bool{
	graph.GraphTypeApp:          true,
	graph.GraphTypeService:      true,
	graph.GraphTypeVersionedApp: true,
	graph.GraphTypeWorkload:     true,
}

// MeshGraphArgs are the optional parameters accepted by the mesh graph tool.
type MeshGraphArgs struct {
	Namespaces   []string `json:"namespaces,omitempty"`
	RateInterval string   `json:"rateInterval,omitempty"`
	GraphType    string   `json:"graphType,omitempty"`
	ClusterName  string   `json:"clusterName,omitempty"`
}

// GetMeshGraphResponse encapsulates the mesh graph tool response.
type GetMeshGraphResponse struct {
	Graph             json.RawMessage    `json:"graph,omitempty"`
	MeshStatus        json.RawMessage    `json:"mesh_status,omitempty"`
	Namespaces        json.RawMessage    `json:"namespaces,omitempty"`
	MeshHealthSummary *MeshHealthSummary `json:"mesh_health_summary,omitempty"`
	Errors            map[string]string  `json:"errors,omitempty"`
}

func Execute(kialiInterface *mcputil.KialiInterface, args map[string]interface{}) (interface{}, int) {
	var toolArgs MeshGraphArgs
	ctx := kialiInterface.Request.Context()

	toolArgs.RateInterval = mcputil.GetStringOrDefault(args, mcputil.DefaultRateInterval, "rateInterval")
	toolArgs.GraphType = mcputil.GetStringOrDefault(args, mcputil.DefaultGraphType, "graphType")
	toolArgs.ClusterName = mcputil.GetStringOrDefault(args, kialiInterface.Conf.KubernetesConfig.ClusterName, "clusterName")

	if !validGraphTypes[toolArgs.GraphType] {
		return fmt.Sprintf("invalid graphType %q: must be one of app, service, versionedApp, workload", toolArgs.GraphType), http.StatusBadRequest
	}

	// Parse namespaces argument (comma-separated string)
	namespaces := make([]string, 0)
	var invalidAccess []string
	invalidStatusCode := http.StatusNotFound
	seen := map[string]struct{}{}

	namespacesArg := mcputil.GetStringArg(args, "namespaces")

	if namespacesArg != "" {
		for _, ns := range strings.Split(namespacesArg, ",") {
			ns_trimmed := strings.TrimSpace(ns)
			if ns_trimmed == "" {
				continue
			}
			// Skip duplicates
			if _, ok := seen[ns_trimmed]; ok {
				continue
			}
			seen[ns_trimmed] = struct{}{}

			// Validate access to this namespace
			if _, statusCode := mcputil.ValidateNamespaceAccess(kialiInterface.Request.Context(), kialiInterface.BusinessLayer, ns_trimmed, toolArgs.ClusterName); statusCode != http.StatusOK {
				invalidAccess = append(invalidAccess, ns_trimmed)
				// Prefer the most severe status among invalid namespaces.
				// 500 > 403 > 404.
				if statusCode == http.StatusInternalServerError ||
					(statusCode == http.StatusForbidden && invalidStatusCode != http.StatusInternalServerError) {
					invalidStatusCode = statusCode
				}
				continue
			}
			namespaces = append(namespaces, ns_trimmed)
		}

		if len(namespaces) == 0 && len(invalidAccess) > 0 {
			return fmt.Sprintf("Namespace(s) %s not found or not accessible. Cannot retrieve traffic graph.", strings.Join(invalidAccess, ", ")), invalidStatusCode
		}
	}

	if len(namespaces) == 0 {
		return "No namespaces were specified. Please provide at least one namespace to generate the traffic graph.", http.StatusOK
	}

	resp := GetMeshGraphResponse{
		Errors: make(map[string]string),
	}

	if len(invalidAccess) > 0 {
		resp.Errors["namespaces"] = fmt.Sprintf("namespace(s) not found or not accessible: %s", strings.Join(invalidAccess, ", "))
	}

	toolArgs.Namespaces = namespaces

	// Fetch all available namespaces for the response
	nsList, nsErr := kialiInterface.BusinessLayer.Namespace.GetClusterNamespaces(ctx, toolArgs.ClusterName)
	if nsErr != nil {
		return nsErr.Error(), http.StatusBadRequest
	}
	raw, marshalErr := json.Marshal(nsList)
	if marshalErr != nil {
		return marshalErr.Error(), http.StatusBadRequest
	}
	resp.Namespaces = raw

	var wg sync.WaitGroup
	var mu sync.Mutex

	wg.Add(3)
	// Health
	go func() {
		defer wg.Done()
		payload, code, errMsg := getHealth(kialiInterface.Request, kialiInterface.Conf, kialiInterface.BusinessLayer, kialiInterface.Prom, toolArgs)
		if code != http.StatusOK {
			mu.Lock()
			resp.Errors["health"] = errMsg
			mu.Unlock()
			return
		}
		summary := computeMeshHealthSummary(payload, toolArgs)
		if summary != nil {
			resp.MeshHealthSummary = summary
		}
	}()
	// Graph
	go func() {
		defer wg.Done()
		defer func() {
			if r := recover(); r != nil {
				var msg string
				switch v := r.(type) {
				case graph.Response:
					msg = v.Message
				case error:
					msg = v.Error()
				case string:
					msg = v
				default:
					msg = fmt.Sprintf("%v", v)
				}
				log.Errorf("get_mesh_traffic_graph: graph goroutine recovered from panic: %s", msg)
				mu.Lock()
				resp.Errors["graph"] = msg
				mu.Unlock()
			}
		}()
		graphReq, _ := http.NewRequestWithContext(ctx, http.MethodGet, "/ai/graph/namespaces", nil)
		q := graphReq.URL.Query()
		q.Set("namespaces", strings.Join(toolArgs.Namespaces, ","))
		if toolArgs.GraphType != "" {
			q.Set("graphType", toolArgs.GraphType)
		}
		if toolArgs.RateInterval != "" {
			q.Set("duration", toolArgs.RateInterval)
		}
		graphReq.URL.RawQuery = q.Encode()
		graphOpts := graph.NewOptions(graphReq, kialiInterface.BusinessLayer, kialiInterface.Conf)

		code, payload, _ := graphApi.GraphNamespaces(ctx, kialiInterface.BusinessLayer, kialiInterface.Prom, graphOpts)
		if code != http.StatusOK {
			mu.Lock()
			resp.Errors["graph"] = payload.(string)
			mu.Unlock()
			return
		}
		raw, err := json.Marshal(payload)
		if err != nil {
			mu.Lock()
			resp.Errors["graph"] = err.Error()
			mu.Unlock()
			return
		}
		resp.Graph = raw
	}()

	// Mesh status (GraphMesh result)
	go func() {
		defer wg.Done()
		defer func() {
			if r := recover(); r != nil {
				var msg string
				switch v := r.(type) {
				case graph.Response:
					msg = v.Message
				case error:
					msg = v.Error()
				case string:
					msg = v
				default:
					msg = fmt.Sprintf("%v", v)
				}
				log.Errorf("get_mesh_traffic_graph: mesh status goroutine recovered from panic: %s", msg)
				mu.Lock()
				resp.Errors["mesh_status"] = msg
				mu.Unlock()
			}
		}()
		meshReq, _ := http.NewRequestWithContext(ctx, http.MethodGet, "/ai/mesh-graph", nil)
		mq := meshReq.URL.Query()
		if toolArgs.RateInterval != "" {
			mq.Set("duration", toolArgs.RateInterval)
		}
		if len(toolArgs.Namespaces) > 0 {
			mq.Set("namespaces", strings.Join(toolArgs.Namespaces, ","))
		}
		meshReq.URL.RawQuery = mq.Encode()
		meshOpts := mesh.NewOptions(meshReq, &kialiInterface.BusinessLayer.Namespace)

		code, payload := meshApi.GraphMesh(ctx, kialiInterface.BusinessLayer, meshOpts, kialiInterface.ClientFactory, kialiInterface.KialiCache, kialiInterface.Conf, kialiInterface.Graphana, kialiInterface.Perses, kialiInterface.Prom, kialiInterface.Discovery)

		if code != http.StatusOK {
			mu.Lock()
			resp.Errors["mesh_status"] = payload.(string)
			mu.Unlock()
			return
		}
		raw, err := json.Marshal(payload)
		if err != nil {
			mu.Lock()
			resp.Errors["mesh_status"] = err.Error()
			mu.Unlock()
			return
		}
		resp.MeshStatus = raw
	}()

	wg.Wait()

	compactResp := TransformGraph(resp.Graph, toolArgs.GraphType, toolArgs.Namespaces, resp.MeshHealthSummary, resp.Errors)
	return compactResp, http.StatusOK
}

func getHealth(r *http.Request, conf *config.Config, businessLayer *business.Layer, prom prometheus.ClientInterface,
	toolArgs MeshGraphArgs) (models.ClustersNamespaceHealth, int, string) {
	result := models.ClustersNamespaceHealth{
		AppHealth:      map[string]*models.NamespaceAppHealth{},
		WorkloadHealth: map[string]*models.NamespaceWorkloadHealth{},
		ServiceHealth:  map[string]*models.NamespaceServiceHealth{},
	}
	var healthType string
	if strings.EqualFold(toolArgs.GraphType, "versionedApp") {
		healthType = "app"
	} else if toolArgs.GraphType == "workload" || toolArgs.GraphType == "service" {
		healthType = toolArgs.GraphType
	} else {
		// For "mesh" or any other graphType, default to "app"
		healthType = "app"
	}

	for _, ns := range toolArgs.Namespaces {
		queryTime := util.Clock.Now()
		healthCriteria := business.NamespaceHealthCriteria{
			Namespace:      ns,
			Cluster:        toolArgs.ClusterName,
			RateInterval:   toolArgs.RateInterval,
			QueryTime:      queryTime,
			IncludeMetrics: true,
		}
		switch healthType {
		case "app":
			health, err := businessLayer.Health.GetNamespaceAppHealth(r.Context(), healthCriteria)
			if err != nil {
				return result, http.StatusInternalServerError, "Error while fetching app health"
			}
			result.AppHealth[ns] = &health
		case "service":
			health, err := businessLayer.Health.GetNamespaceServiceHealth(r.Context(), healthCriteria)
			if err != nil {
				return result, http.StatusInternalServerError, "Error while fetching service health"
			}
			result.ServiceHealth[ns] = &health
		case "workload":
			health, err := businessLayer.Health.GetNamespaceWorkloadHealth(r.Context(), healthCriteria)
			if err != nil {
				return result, http.StatusInternalServerError, "Error while fetching workload health"
			}
			result.WorkloadHealth[ns] = &health
		}
	}
	return result, http.StatusOK, ""
}
