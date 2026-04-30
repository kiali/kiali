package get_mesh_traffic_graph

import (
	"encoding/json"
	"fmt"
	"strconv"

	graphCommon "github.com/kiali/kiali/graph/config/common"
)

func TransformGraph(graphRaw json.RawMessage, graphType string, namespaces []string, healthSummary *MeshHealthSummary, errors map[string]string) CompactGraphResponse {
	resp := CompactGraphResponse{
		GraphType:  graphType,
		Health:     healthSummary,
		Namespaces: namespaces,
		Nodes:      []CompactNode{},
		Traffic:    []CompactEdge{},
	}

	if len(errors) > 0 {
		resp.Errors = errors
	}

	if graphRaw == nil {
		return resp
	}

	var cfg graphCommon.Config
	if err := json.Unmarshal(graphRaw, &cfg); err != nil {
		if resp.Errors == nil {
			resp.Errors = make(map[string]string)
		}
		resp.Errors["graph_parse"] = err.Error()
		return resp
	}

	nodeIndex := buildNodeIndex(cfg.Elements.Nodes)

	for _, nw := range cfg.Elements.Nodes {
		n := nw.Data
		if n.IsBox != "" {
			continue
		}
		resp.Nodes = append(resp.Nodes, CompactNode{
			Name:    resolveNodeName(n),
			Type:    n.NodeType,
			Version: n.Version,
		})
	}

	for _, ew := range cfg.Elements.Edges {
		e := ew.Data
		sourceName := resolveNodeLabel(nodeIndex, e.Source)
		targetName := resolveNodeLabel(nodeIndex, e.Target)

		protocol := ""
		if e.Traffic.Protocol != "" {
			protocol = e.Traffic.Protocol
		}

		mtls := false
		if e.IsMTLS == "100" {
			mtls = true
		}

		responseTime := 0
		if e.ResponseTime != "" {
			if v, err := strconv.Atoi(e.ResponseTime); err == nil {
				responseTime = v
			}
		}

		resp.Traffic = append(resp.Traffic, CompactEdge{
			Health:         e.HealthStatus,
			MTLS:           mtls,
			Protocol:       protocol,
			ResponseTimeMs: responseTime,
			Source:         sourceName,
			Target:         targetName,
			Throughput:     e.Throughput,
		})
	}

	return resp
}

func buildNodeIndex(nodes []*graphCommon.NodeWrapper) map[string]*graphCommon.NodeData {
	idx := make(map[string]*graphCommon.NodeData, len(nodes))
	for _, nw := range nodes {
		idx[nw.Data.ID] = nw.Data
	}
	return idx
}

func resolveNodeName(n *graphCommon.NodeData) string {
	if n.App != "" {
		return n.App
	}
	if n.Workload != "" {
		return n.Workload
	}
	if n.Service != "" {
		return n.Service
	}
	return n.ID
}

func resolveNodeLabel(index map[string]*graphCommon.NodeData, id string) string {
	n, ok := index[id]
	if !ok {
		return id
	}
	name := resolveNodeName(n)
	if n.Version != "" && n.Version != "unknown" {
		return fmt.Sprintf("%s (%s)", name, n.Version)
	}
	return name
}
