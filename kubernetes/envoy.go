package kubernetes

import "github.com/mitchellh/mapstructure"

// Root of ConfigDump
type ConfigDump struct {
	Configs []interface{} `json:"configs"`
}

type ClusterDump struct {
	DynamicClusters []EnvoyClusterWrapper `mapstructure:"dynamic_active_clusters"`
	StaticClusters  []EnvoyClusterWrapper `mapstructure:"static_clusters"`
}

type EnvoyClusterWrapper struct {
	Cluster EnvoyCluster `mapstructure:"cluster"`
}

type EnvoyCluster struct {
	Name     string         `mapstructure:"name"`
	Type     string         `mapstructure:"type"`
	Metadata *EnvoyMetadata `mapstructure:"metadata,omitempty"`
}

type EnvoyMetadata struct {
	FilterMetadata *struct {
		Istio *struct {
			Config string `mapstructure:"config,omitempty"`
		} `mapstructure:"istio,omitempty"`
	} `mapstructure:"filter_metadata,omitempty"`
}

type RouteDump struct {
	DynamicRouteConfigs []EnvoyRouteConfig `mapstructure:"dynamic_route_configs"`
	StaticRouteConfigs  []EnvoyRouteConfig `mapstructure:"static_route_configs"`
}

type EnvoyRouteConfig struct {
	RouteConfig *RouteConfig `mapstructure:"route_config,omitempty"`
}

type ListenerDump struct {
	DynamicListeners []DynamicListener `mapstructure:"dynamic_listeners"`
	StaticListeners  []StaticListener  `mapstructure:"static_listeners"`
}

type DynamicListener struct {
	Name        string         `mapstructure:"name"`
	ActiveState StaticListener `mapstructure:"active_state"`
}

type StaticListener struct {
	LastUpdated string        `mapstructure:"last_updated"`
	VersionInfo string        `mapstructure:"version_info"`
	Listener    EnvoyListener `mapstructure:"listener"`
}

type EnvoyListener struct {
	Address struct {
		SocketAddress struct {
			Address   string  `mapstructure:"address"`
			PortValue float64 `mapstructure:"port_value"`
		} `mapstructure:"socket_address"`
	} `mapstructure:"address"`
	FilterChains       []EnvoyFilterChain `mapstructure:"filter_chains,omitempty"`
	DefaultFilterChain *EnvoyFilterChain  `mapstructure:"default_filter_chain,omitempty"`
}

type EnvoyFilterChain struct {
	Filters          []EnvoyListenerFilter `mapstructure:"filters"`
	FilterChainMatch *FilterChainMatch     `mapstructure:"filter_chain_match"`
}

type EnvoyListenerFilter struct {
	Name        string `mapstructure:"name"`
	TypedConfig struct {
		Type        string       `mapstructure:"@type"`
		Cluster     string       `mapstructure:"cluster"`
		RouteConfig *RouteConfig `mapstructure:"route_config,omitempty"`
		Rds         *struct {
			RouteConfigName string `mapstructure:"route_config_name"`
		} `mapstructure:"rds,omitempty"`
	} `mapstructure:"typed_config"`
}

type RouteConfig struct {
	Name         string              `mapstructure:"name"`
	VirtualHosts []VirtualHostFilter `mapstructure:"virtual_hosts,omitempty"`
}

type VirtualHostFilter struct {
	Domains []string `mapstructure:"domains,omitempty"`
	Name    string   `mapstructure:"name,omitempty"`
	Routes  []struct {
		Name     string                 `mapstructure:"name"`
		Match    map[string]interface{} `mapstructure:"match"`
		Metadata *EnvoyMetadata         `mapstructure:"metadata,omitempty"`
		Route    *struct {
			Cluster string `mapstructure:"cluster,omitempty"`
		} `mapstructure:"route,omitempty"`
	} `mapstructure:"routes,omitempty"`
}

type FilterChainMatch struct {
	ApplicationProtocols []string `mapstructure:"application_protocols,omitempty"`
	TransportProtocol    string   `mapstructure:"transport_protocol,omitempty"`
	ServerNames          []string `mapstructure:"server_names,omitempty"`
	DestinationPort      *int32   `mapstructure:"destination_port,omitempty"`
	PrefixRanges         []struct {
		AddressPrefix string `mapstructure:"address_prefix"`
		PrefixLen     int    `mapstructure:"prefix_len"`
	} `mapstructure:"prefix_ranges"`
}

func (cd *ConfigDump) GetListeners() (*ListenerDump, error) {
	listenersDumpRaw := cd.GetConfig("type.googleapis.com/envoy.admin.v3.ListenersConfigDump")
	var listenersDump ListenerDump
	return &listenersDump, mapstructure.Decode(listenersDumpRaw, &listenersDump)
}

func (cd *ConfigDump) GetClusters() (*ClusterDump, error) {
	clusterDumpRaw := cd.GetConfig("type.googleapis.com/envoy.admin.v3.ClustersConfigDump")
	var clusterDump ClusterDump
	return &clusterDump, mapstructure.Decode(clusterDumpRaw, &clusterDump)
}

func (cd *ConfigDump) GetRoutes() (*RouteDump, error) {
	routeDumpRaw := cd.GetConfig("type.googleapis.com/envoy.admin.v3.RoutesConfigDump")
	var routeDump RouteDump
	return &routeDump, mapstructure.Decode(routeDumpRaw, &routeDump)
}

func (cd *ConfigDump) GetConfig(objectType string) map[string]interface{} {
	for _, configRaw := range cd.Configs {
		conf, ok := configRaw.(map[string]interface{})
		if !ok {
			continue
		}

		configType, ok := conf["@type"]
		if !ok {
			continue
		}

		if configType == objectType {
			return conf
		}
	}
	return nil
}
