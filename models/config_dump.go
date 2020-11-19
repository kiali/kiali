package models

import (
	"fmt"
	"strconv"
	"strings"

	adminapi "github.com/envoyproxy/go-control-plane/envoy/admin/v3"
	cluster "github.com/envoyproxy/go-control-plane/envoy/config/cluster/v3"
	envoy_config_core_v3 "github.com/envoyproxy/go-control-plane/envoy/config/core/v3"
	listener "github.com/envoyproxy/go-control-plane/envoy/config/listener/v3"
	route "github.com/envoyproxy/go-control-plane/envoy/config/route/v3"
	"github.com/golang/protobuf/ptypes"

	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util/config_dump"
)

type ConfigDump struct {
	configDump *config_dump.ConfigDump

	Clusters  ClustersDump  `json:"clusters"`
	Listeners ListenersDump `json:"listeners"`
	Routes    RoutesDump    `json:"routes"`
	Secrets   interface{}   `json:"secrets"`
}

type ClustersDump struct {
	VersionInfo           string     `json:"version_info"`
	StaticClusters        []*Cluster `json:"static_clusters"`
	DynamicActiveClusters []*Cluster `json:"dynamic_active_clusters"`
}

type Cluster struct {
	Cluster     *cluster.Cluster `json:"cluster"`
	LastUpdated string           `json:"last_updated"`
	VersionInfo string           `json:"version_info,omitempty"`
}

type ListenersDump struct {
	VersionInfo      string               `json:"version_info"`
	StaticListeners  []*listener.Listener `json:"static_listeners"`
	DynamicListeners []*listener.Listener `json:"dynamic_active_listeners"`
}

type RoutesDump struct {
	StaticRouteConfigs  []*RouteConfig `json:"static_route_configs"`
	DynamicRouteConfigs []*RouteConfig `json:"dynamic_route_configs"`
}

type RouteConfig struct {
	Route       *route.RouteConfiguration `json:"route"`
	LastUpdated string                    `json:"last_updated"`
	VersionInfo string                    `json:"version_info,omitempty"`
}

type ClusterSummary struct {
	ServiceFQDN string `json:"service_fqdn"`
	Port        int    `json:"port"`
	Subset      string `json:"subset"`
	Direction   string `json:"direction"`
	Type        int32  `json:"type"`
}

type RouteSummary struct {
	Name           string `json:"name"`
	Domains        string `json:"domains"`
	Match          string `json:"match"`
	VirtualService string `json:"virtual_service"`
}

type ProxyConfigSummarizer interface {
	Summary() interface{}
}

type ClusterSummarizer struct {
	*ConfigDump
}

type RouteSummarizer struct {
	*ConfigDump
}

func NewConfigDump(dump *config_dump.ConfigDump) *ConfigDump {
	return &ConfigDump{configDump: dump}
}

func (cd *ConfigDump) UnmarshallAll() {
	cd.UnmarshallClusters()
	cd.UnmarshallListeners()
	cd.UnmarshallRoutes()
	cd.UnmarshallSecrets()
}

func (cd *ConfigDump) UnmarshallClusters() {
	clusterDump := &adminapi.ClustersConfigDump{}
	clusterStruct := ClustersDump{}

	clusterAny := cd.configDump.GetConfig("type.googleapis.com/envoy.admin.v3.ClustersConfigDump")
	if clusterAny == nil {
		return
	}

	err := ptypes.UnmarshalAny(clusterAny, clusterDump)
	if err != nil {
		log.Errorf("Error unmarshalling config_dump.config: %v", err)
		return
	}

	clusterStruct.VersionInfo = clusterDump.VersionInfo

	clusters := make([]*Cluster, 0)
	for _, c := range clusterDump.DynamicActiveClusters {
		if c.Cluster != nil {
			dcd := &cluster.Cluster{}
			err = ptypes.UnmarshalAny(c.Cluster, dcd)
			if err != nil {
				continue
			}
			clusters = append(clusters, &Cluster{
				Cluster:     dcd,
				LastUpdated: ptypes.TimestampString(c.LastUpdated),
				VersionInfo: c.VersionInfo,
			})
		}
	}
	clusterStruct.DynamicActiveClusters = clusters

	clusters = make([]*Cluster, 0)
	for _, c := range clusterDump.StaticClusters {
		if c.Cluster != nil {
			dcd := &cluster.Cluster{}
			err = ptypes.UnmarshalAny(c.Cluster, dcd)
			if err != nil {
				continue
			}
			clusters = append(clusters, &Cluster{
				Cluster:     dcd,
				LastUpdated: ptypes.TimestampString(c.LastUpdated),
			})
		}
	}
	clusterStruct.StaticClusters = clusters

	cd.Clusters = clusterStruct
}

func (cd *ConfigDump) UnmarshallListeners() {
	cd.Listeners = ListenersDump{}
	listenerAny := cd.configDump.GetConfig("type.googleapis.com/envoy.admin.v3.ListenersConfigDump")
	if listenerAny == nil {
		return
	}

	listenerDump := &adminapi.ListenersConfigDump{}
	err := ptypes.UnmarshalAny(listenerAny, listenerDump)
	if err != nil {
		return
	}

	cd.Listeners.VersionInfo = listenerDump.VersionInfo

	listeners := make([]*listener.Listener, 0)
	for _, l := range listenerDump.DynamicListeners {
		if l.ActiveState != nil && l.ActiveState.Listener != nil {
			lcd := &listener.Listener{}
			err = ptypes.UnmarshalAny(l.ActiveState.Listener, lcd)
			if err != nil {
				continue
			}
			listeners = append(listeners, lcd)
		}
	}
	cd.Listeners.DynamicListeners = listeners

	listeners = make([]*listener.Listener, 0)
	for _, l := range listenerDump.StaticListeners {
		if l.Listener != nil {
			lcd := &listener.Listener{}
			err = ptypes.UnmarshalAny(l.Listener, lcd)
			if err != nil {
				continue
			}
			listeners = append(listeners, lcd)
		}
	}
	cd.Listeners.StaticListeners = listeners
}

func (cd *ConfigDump) UnmarshallRoutes() {
	cd.Routes = RoutesDump{}
	routesAny := cd.configDump.GetConfig("type.googleapis.com/envoy.admin.v3.RoutesConfigDump")
	if routesAny == nil {
		return
	}

	routesDump := &adminapi.RoutesConfigDump{}
	err := ptypes.UnmarshalAny(routesAny, routesDump)
	if err != nil {
		return
	}

	routes := make([]*RouteConfig, 0)
	for _, routeConf := range routesDump.DynamicRouteConfigs {
		if routeConf.RouteConfig != nil {
			rcd := &route.RouteConfiguration{}
			err = ptypes.UnmarshalAny(routeConf.RouteConfig, rcd)
			if err != nil {
				continue
			}
			routes = append(routes, &RouteConfig{
				Route:       rcd,
				LastUpdated: ptypes.TimestampString(routeConf.LastUpdated),
				VersionInfo: routeConf.VersionInfo,
			})
		}
	}
	cd.Routes.DynamicRouteConfigs = routes

	routes = make([]*RouteConfig, 0)
	for _, routeConf := range routesDump.StaticRouteConfigs {
		if routeConf.RouteConfig != nil {
			rcd := &route.RouteConfiguration{}
			err = ptypes.UnmarshalAny(routeConf.RouteConfig, rcd)
			if err != nil {
				continue
			}
			routes = append(routes, &RouteConfig{
				Route:       rcd,
				LastUpdated: ptypes.TimestampString(routeConf.LastUpdated),
			})
		}
	}
	cd.Routes.StaticRouteConfigs = routes
}

func (cd *ConfigDump) UnmarshallSecrets() {
	// TODO: implement the unmarshalling of the secrets
}

func (cs ClusterSummarizer) Summary() interface{} {
	cs.UnmarshallClusters()
	clusters := make([]*ClusterSummary, 0, len(cs.Clusters.DynamicActiveClusters)+len(cs.Clusters.StaticClusters))

	for _, clusterSet := range [][]*Cluster{cs.Clusters.StaticClusters, cs.Clusters.DynamicActiveClusters} {
		for _, cluster := range clusterSet {
			clusters = append(clusters, cluster.summary())
		}
	}

	return clusters
}

func (c Cluster) summary() *ClusterSummary {
	summary := &ClusterSummary{
		ServiceFQDN: c.Cluster.Name,
		Port:        0,
		Subset:      "",
		Direction:   "",
		Type:        int32(c.Cluster.GetType()),
	}

	parts := strings.Split(c.Cluster.Name, "|")
	if len(parts) > 3 {
		summary.ServiceFQDN = parts[3]
		summary.Port, _ = strconv.Atoi(strings.TrimSuffix(parts[1], "_"))
		summary.Subset = parts[2]
		summary.Direction = strings.TrimSuffix(parts[0], "_")
		summary.Type = int32(c.Cluster.GetType())
	}

	return summary
}

func (cs RouteSummarizer) Summary() interface{} {
	cs.UnmarshallRoutes()
	routes := make([]*RouteSummary, 0, len(cs.Routes.StaticRouteConfigs)+len(cs.Routes.DynamicRouteConfigs))

	for _, routeSet := range [][]*RouteConfig{cs.Routes.StaticRouteConfigs, cs.Routes.DynamicRouteConfigs} {
		for _, route := range routeSet {
			routes = append(routes, route.summary()...)
		}
	}

	return routes
}

func (r RouteConfig) summary() []*RouteSummary {
	routes := make([]*RouteSummary, 0, len(r.Route.GetVirtualHosts()))

	for _, vhs := range r.Route.GetVirtualHosts() {
		for _, route := range vhs.GetRoutes() {
			route := &RouteSummary{
				Name:           r.Route.Name,
				Domains:        bestDomainMatch(vhs.GetDomains()),
				Match:          matchSummary(route.GetMatch()),
				VirtualService: istioMetadata(route.GetMetadata()),
			}
			routes = append(routes, route)
		}
	}
	return routes
}

func matchSummary(match *route.RouteMatch) string {
	conds := []string{}
	if match.GetPrefix() != "" {
		conds = append(conds, fmt.Sprintf("%s*", match.GetPrefix()))
	}
	if match.GetPath() != "" {
		conds = append(conds, match.GetPath())
	}
	if match.GetSafeRegex() != nil {
		conds = append(conds, fmt.Sprintf("regex %s", match.GetSafeRegex().String()))
	}
	// Ignore headers
	return strings.Join(conds, " ")
}

func bestDomainMatch(domains []string) string {
	if len(domains) == 0 {
		return ""
	}

	if len(domains) == 1 {
		return domains[0]
	}

	bestMatch := domains[0]
	for _, domain := range domains {
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

func istioMetadata(metadata *envoy_config_core_v3.Metadata) string {
	if metadata == nil {
		return ""
	}
	istioMetadata, ok := metadata.FilterMetadata["istio"]
	if !ok {
		return ""
	}
	config, ok := istioMetadata.Fields["config"]
	if !ok {
		return ""
	}
	return renderConfig(config.GetStringValue())
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
