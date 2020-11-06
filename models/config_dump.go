package models

import (
	adminapi "github.com/envoyproxy/go-control-plane/envoy/admin/v3"
	cluster "github.com/envoyproxy/go-control-plane/envoy/config/cluster/v3"
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

func NewConfigDump(dump *config_dump.ConfigDump) *ConfigDump {
	cd := &ConfigDump{}
	cd.configDump = dump
	return cd
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

}
