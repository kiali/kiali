package get_mesh_graph

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"sync"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/graph"
	graphApi "github.com/kiali/kiali/graph/api"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/mesh"
	meshApi "github.com/kiali/kiali/mesh/api"
	"github.com/kiali/kiali/perses"
	"github.com/kiali/kiali/prometheus"
)



// MeshGraphArgs are the optional parameters accepted by the mesh graph tool.
type MeshGraphArgs struct {
	Namespaces   []string `json:"namespaces,omitempty"`
	RateInterval string   `json:"rateInterval,omitempty"`
	GraphType    string   `json:"graphType,omitempty"`
}

// MeshHealthSummary captures aggregated health data (placeholder for future use).
type MeshHealthSummary struct{}

// GetMeshGraphResponse encapsulates the mesh graph tool response.
type GetMeshGraphResponse struct {
	Graph             json.RawMessage    `json:"graph,omitempty"`
	MeshStatus        json.RawMessage    `json:"mesh_status,omitempty"`
	Namespaces        json.RawMessage    `json:"namespaces,omitempty"`
	MeshHealthSummary *MeshHealthSummary `json:"mesh_health_summary,omitempty"`
	Errors            map[string]string  `json:"errors,omitempty"`
}

func Execute(ctx context.Context, args map[string]interface{}, business *business.Layer, prom prometheus.ClientInterface, clientFactory kubernetes.ClientFactory, kialiCache cache.KialiCache, conf *config.Config, grafana *grafana.Service, perses *perses.Service, discovery *istio.Discovery) (interface{}, int) {
	var toolArgs MeshGraphArgs

	// Parse arguments: allow either `namespace` or `namespaces` (comma-separated string)
	namespaces := make([]string, 0)
	if v, ok := args["namespace"].(string); ok {
		v = strings.TrimSpace(v)
		if v != "" {
			namespaces = append(namespaces, v)
		}
	}
	if v, ok := args["namespaces"].(string); ok {
		for _, ns := range strings.Split(v, ",") {
			ns = strings.TrimSpace(ns)
			if ns != "" {
				namespaces = append(namespaces, ns)
			}
		}
	}
	// Deduplicate namespaces if both provided
	if len(namespaces) > 1 {
		seen := map[string]struct{}{}
		unique := make([]string, 0, len(namespaces))
		for _, ns := range namespaces {
			key := strings.TrimSpace(ns)
			if key == "" {
				continue
			}
			if _, ok := seen[key]; ok {
				continue
			}
			seen[key] = struct{}{}
			unique = append(unique, key)
		}
		namespaces = unique
	}
	toolArgs.Namespaces = namespaces

	if v, ok := args["rateInterval"].(string); ok {
		toolArgs.RateInterval = strings.TrimSpace(v)
	}
	if v, ok := args["graphType"].(string); ok {
		toolArgs.GraphType = strings.TrimSpace(v)
	}

	resp := GetMeshGraphResponse{
		Errors: make(map[string]string),
	}

	// Default graph type when not provided.
	if toolArgs.GraphType == "" {
		toolArgs.GraphType = graph.GraphTypeVersionedApp
	}

	// Always fetch namespaces first so we can default to all when none are provided.
	nsList, nsErr := business.Namespace.GetNamespaces(ctx)
	if nsErr != nil {
		resp.Errors["namespaces"] = nsErr.Error()
	} else {
		if raw, marshalErr := json.Marshal(nsList); marshalErr == nil {
			resp.Namespaces = raw
		} else {
			resp.Errors["namespaces"] = marshalErr.Error()
		}
		// If caller didn't provide namespaces, default to all available.
		if len(namespaces) == 0 {
			toolArgs.Namespaces = make([]string, 0, len(nsList))
			for _, ns := range nsList {
				if ns.Name != "" {
					toolArgs.Namespaces = append(toolArgs.Namespaces, ns.Name)
				}
			}
		} else {
			toolArgs.Namespaces = namespaces
		}
	}

	// If we still have no namespaces to work with, return early with error info.
	if len(toolArgs.Namespaces) == 0 {
		if len(resp.Errors) == 0 {
			resp.Errors["namespaces"] = "no namespaces available"
		}
		return resp, http.StatusBadRequest
	}

	var wg sync.WaitGroup
	var mu sync.Mutex

	wg.Add(2)
	// Graph
	go func() {
		defer wg.Done()
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
		graphOpts := graph.NewOptions(graphReq, business)

		code, payload := graphApi.GraphNamespaces(ctx, business, prom, graphOpts)
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
		meshReq, _ := http.NewRequestWithContext(ctx, http.MethodGet, "/ai/mesh-graph", nil)
		mq := meshReq.URL.Query()
		if toolArgs.RateInterval != "" {
			mq.Set("duration", toolArgs.RateInterval)
		}
		if len(toolArgs.Namespaces) > 0 {
			mq.Set("namespaces", strings.Join(toolArgs.Namespaces, ","))
		}
		meshReq.URL.RawQuery = mq.Encode()
		meshOpts := mesh.NewOptions(meshReq, &business.Namespace)

		code, payload := meshApi.GraphMesh(ctx, business, meshOpts, clientFactory, kialiCache, conf, grafana, perses, prom, discovery)

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

	return resp, http.StatusOK
}
