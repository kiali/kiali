package models

import (
	"fmt"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"strconv"
	"strings"

	listener "github.com/envoyproxy/go-control-plane/envoy/config/listener/v3"
)

type ListenersDump struct {
	VersionInfo      string               `json:"version_info"`
	StaticListeners  []*listener.Listener `json:"static_listeners"`
	DynamicListeners []*listener.Listener `json:"dynamic_active_listeners"`
}

type Clusters []*Cluster
type Cluster struct {
	ServiceFQDN string `json:"service_fqdn"`
	Port        int    `json:"port"`
	Subset      string `json:"subset"`
	Direction   string `json:"direction"`
	Type        string  `json:"type"`
	DestinationRule string `json:"destination_rule"`
}

type Routes []*Route
type Route struct {
	Name           string `json:"name"`
	Domains        string `json:"domains"`
	Match          string `json:"match"`
	VirtualService string `json:"virtual_service"`
}

type Bootstrap struct {
	Bootstrap map[string]interface{} `json:"bootstrap,inline"`
}

type ResourceDump interface {
	Parse(dump *kubernetes.ConfigDump)
}

func (css *Clusters) Parse(dump *kubernetes.ConfigDump) {
	clusterDumpRaw := dump.GetConfig("type.googleapis.com/envoy.admin.v3.ClustersConfigDump")
	dynamicActiveClusters, ok := clusterDumpRaw["dynamic_active_clusters"]
	if !ok {
		log.Error("unexpected format of the config dump in the ClustersDump")
	}

	dac, ok := dynamicActiveClusters.([]interface{})
	if !ok {
		log.Error("unexpected format of the config dump in the ClustersDump")
	}

	staticClusters, ok := clusterDumpRaw["static_clusters"]
	if !ok {
		log.Error("unexpected format of the config dump in the ClustersDump")
	}

	sc, ok := staticClusters.([]interface{})
	if !ok {
		log.Error("unexpected format of the config dump in the ClustersDump")
	}

	for _, clusterSet := range [][]interface{}{sc, dac} {
		for _, clusterRaw := range clusterSet {
			cluster, ok := clusterRaw.(map[string]interface{})
			if !ok {
				log.Error("unexpected format of the config dump in the ClustersDump")
			}
			cs := &Cluster{}
			cs.Parse(cluster["cluster"].(map[string]interface{}))
			*css = append(*css, cs)
		}
	}
}

func (cs *Cluster) Parse(cluster map[string]interface{}) {
	cs.ServiceFQDN = cluster["name"].(string)
	cs.Type = cluster["type"].(string)
	cs.Port = 0
	cs.Subset = ""
	cs.Direction = ""
	cs.DestinationRule = ""

	parts := strings.Split(cs.ServiceFQDN, "|")
	if len(parts) > 3 {
		cs.ServiceFQDN = parts[3]
		cs.Port, _ = strconv.Atoi(strings.TrimSuffix(parts[1], "_"))
		cs.Subset = parts[2]
		cs.Direction = strings.TrimSuffix(parts[0], "_")
		cs.DestinationRule = istioMetadata(cluster["metadata"])
	}
}

func (rs *Routes) Parse(dump *kubernetes.ConfigDump) {
	routesDumpRaw := dump.GetConfig("type.googleapis.com/envoy.admin.v3.RoutesConfigDump")

	dynamicRoutes, ok := routesDumpRaw["dynamic_route_configs"]
	if !ok {
		log.Error("unexpected format of the config dump in the RouteDump")
	}

	dr, ok := dynamicRoutes.([]interface{})
	if !ok {
		log.Error("unexpected format of the config dump in the RouteDump")
	}

	staticRoutes, ok := routesDumpRaw["static_route_configs"]
	if !ok {
		log.Error("unexpected format of the config dump in the RouteDump")
	}

	sr, ok := staticRoutes.([]interface{})
	if !ok {
		log.Error("unexpected format of the config dump in the RouteDump")
	}

	for _, routeSet := range [][]interface{}{dr, sr} {
		for _, routeRaw := range routeSet {
			route, ok := routeRaw.(map[string]interface{})
			if !ok {
				log.Error("unexpected format of the config dump in the RouteDump")
			}

			rc := route["route_config"].(map[string]interface{})
			rcName, found := rc["name"]
			if !found {
				rcName = ""
			}
			virtualHosts := rc["virtual_hosts"].([]interface{})

			for _, vhsRaw := range virtualHosts {
				vhs := vhsRaw.(map[string]interface{})
				vhsRoutes := vhs["routes"].([]interface{})
				for _, routeRaw := range vhsRoutes {
					routeMap := routeRaw.(map[string]interface{})
					route := &Route{
						Name:           rcName.(string),
						Domains:        bestDomainMatch(vhs["domains"].([]interface{})),
						Match:          matchSummary(routeMap["match"].(map[string]interface{})),
						VirtualService: istioMetadata(routeMap["metadata"]),
					}
					*rs = append(*rs, route)
				}
			}
		}
	}
}

func (bd *Bootstrap) Parse(dump *kubernetes.ConfigDump) {
	bd.Bootstrap = dump.GetConfig("type.googleapis.com/envoy.admin.v3.BootstrapConfigDump")
}

func matchSummary(match map[string]interface{}) string {
	conds := []string{}
	if prefixRaw, found := match["prefix"]; found && prefixRaw.(string) != "" {
		conds = append(conds, fmt.Sprintf("%s*", prefixRaw))
	}
	if pathRaw, found := match["path"]; found && pathRaw.(string) != "" {
		conds = append(conds, fmt.Sprintf("%s", pathRaw))
	}

	if  safeRegex, found := match["safe_regex"]; found {
		conds = append(conds, fmt.Sprintf("regex %s", safeRegex))
	}
	// Ignore headers
	return strings.Join(conds, " ")
}

func bestDomainMatch(domains []interface{}) string {
	if len(domains) == 0 {
		return ""
	}

	if len(domains) == 1 {
		return domains[0].(string)
	}

	bestMatch := domains[0].(string)
	for _, domainRaw := range domains {
		domain := domainRaw.(string)
		if len(domain) == 0 {
			continue
		}

		if domain[0] <= '9' {
			continue
		}

		if len(bestMatch) > len(domain) {
			bestMatch = domain
		}
	}
	return bestMatch
}

func istioMetadata(metadata interface{}) string {
	if metadata == nil {
		return ""
	}
	metadataMap, ok := metadata.(map[string]interface{})
	if !ok {
		return ""
	}
	filterMetadataRaw, ok := metadataMap["filter_metadata"]
	if !ok {
		return ""
	}
	filterMetadata, ok := filterMetadataRaw.(map[string]interface{})
	if !ok {
		return ""
	}

	istioMetadataRaw, ok := filterMetadata["istio"]
	if !ok {
		return ""
	}

	istioMetadata, ok := istioMetadataRaw.(map[string]interface{})
	if !ok {
		return ""
	}

	config, ok := istioMetadata["config"]
	if !ok {
		return ""
	}

	return renderConfig(config.(string))
}

func renderConfig(configPath string) string {
	if strings.HasPrefix(configPath, "/apis/networking.istio.io/v1alpha3/namespaces/") {
		parts := strings.Split(configPath, "/")
		if len(parts) != 8 {
			return ""
		}
		return fmt.Sprintf("%s.%s", parts[7], parts[5])
	}
	return "<unknown>"
}
