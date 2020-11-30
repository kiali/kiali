package models

import (
	"fmt"
	"github.com/kiali/kiali/kubernetes"
	"github.com/mitchellh/mapstructure"
	"strconv"
	"strings"
)

type Listeners []*Listener
type Listener struct {
	Address     string  `json:"address"`
	Port        float64 `json:"port"`
	Match       string  `json:"match"`
	Destination string  `json:"destination"`
}

type Clusters []*Cluster
type Cluster struct {
	ServiceFQDN     string `json:"service_fqdn"`
	Port            int    `json:"port"`
	Subset          string `json:"subset"`
	Direction       string `json:"direction"`
	Type            string `json:"type"`
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

type ClusterDump struct {
	DynamicClusters []EnvoyClusterWrapper `mapstructure:"dynamic_active_clusters"`
	StaticClusters []EnvoyClusterWrapper `mapstructure:"static_clusters"`
}

type EnvoyClusterWrapper struct {
	Cluster EnvoyCluster `mapstructure:"cluster"`
}

type EnvoyCluster struct {
	Name string `mapstructure:"name"`
	Type string `mapstructure:"type"`
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
	StaticRouteConfigs []EnvoyRouteConfig `mapstructure:"static_route_configs"`
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
		Name  string                 `mapstructure:"name"`
		Match map[string]interface{} `mapstructure:"match"`
		Metadata *EnvoyMetadata `mapstructure:"metadata,omitempty"`
		Route *struct {
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

func (ls *Listeners) Parse(dump *kubernetes.ConfigDump) {
	listenersDumpRaw := dump.GetConfig("type.googleapis.com/envoy.admin.v3.ListenersConfigDump")
	var listenersDump ListenerDump
	err := mapstructure.Decode(listenersDumpRaw, &listenersDump)
	if err != nil {
		return
	}

	listeners := make([]EnvoyListener, 0, len(listenersDump.StaticListeners)+len(listenersDump.DynamicListeners))
	for _, dynamicListener := range listenersDump.DynamicListeners {
		listeners = append(listeners, dynamicListener.ActiveState.Listener)
	}
	for _, staticListener := range listenersDump.StaticListeners {
		listeners = append(listeners, staticListener.Listener)
	}

	for _, listener := range listeners {
		for _, match := range listenerMatches(listener) {
			*ls = append(*ls, &Listener{
				Address:     listener.Address.SocketAddress.Address,
				Port:        listener.Address.SocketAddress.PortValue,
				Match:       match["match"].(string),
				Destination: match["destination"].(string),
			})
		}
	}
}

func listenerMatches(listener EnvoyListener) []map[string]interface{} {
	chains := listener.FilterChains
	if listener.DefaultFilterChain != nil {
		chains = append(chains, *listener.DefaultFilterChain)
	}

	matches := make([]map[string]interface{}, 0, len(chains))
	for _, chain := range chains {
		descriptors := make([]string, 0)

		match := chain.FilterChainMatch
		if match == nil {
			match = &FilterChainMatch{}
		}

		if len(match.ServerNames) > 0 {
			descriptors = append(descriptors, fmt.Sprintf("SNI: %s", strings.Join(match.ServerNames, ",")))
		}

		if len(match.TransportProtocol) > 0 {
			descriptors = append(descriptors, fmt.Sprintf("Trans: %s", match.TransportProtocol))
		}

		if apd := getAppDescriptor(match); apd != "" {
			descriptors = append(descriptors, apd)
		}

		port := ""
		if match.DestinationPort != nil {
			port = fmt.Sprintf(":%d", match.DestinationPort)
		}

		if len(match.PrefixRanges) > 0 {
			pfs := []string{}
			for _, p := range match.PrefixRanges {
				pfs = append(pfs, fmt.Sprintf("%s/%d", p.AddressPrefix, p.PrefixLen))
			}
			descriptors = append(descriptors, fmt.Sprintf("Addr: %s%s", strings.Join(pfs, ","), port))
		} else if port != "" {
			descriptors = append(descriptors, fmt.Sprintf("Addr: *%s", port))
		}

		if len(descriptors) == 0 {
			descriptors = []string{"ALL"}
		}

		matches = append(matches, map[string]interface{}{
			"match":       strings.Join(descriptors, ";"),
			"destination": getListenerDestination(chain.Filters),
		})
	}
	return matches
}

func getListenerDestination(filters []EnvoyListenerFilter) string {
	if len(filters) == 0 {
		return ""
	}

	for _, filter := range filters {
		if filter.Name == "envoy.filters.network.http_connection_manager" {
			typedConfig := filter.TypedConfig
			if typedConfig.RouteConfig != nil {
				if cluster := getMatchAllCluster(typedConfig.RouteConfig); cluster != "" {
					return cluster
				}
				vhosts := []string{}
				for _, vh := range typedConfig.RouteConfig.VirtualHosts {
					if describeDomains(vh) == "" {
						vhosts = append(vhosts, describeRoutes(vh))
					} else {
						vhosts = append(vhosts, fmt.Sprintf("%s %s", describeDomains(vh), describeRoutes(vh)))
					}
				}
				return fmt.Sprintf("Inline Route: %s", strings.Join(vhosts, "; "))
			}

			if typedConfig.Rds != nil && typedConfig.Rds.RouteConfigName != "" {
				return fmt.Sprintf("Route: %s", typedConfig.Rds.RouteConfigName)
			}

			return "HTTP"
		} else if filter.Name == "envoy.filters.network.tcp_proxy" {
			typedConfig := filter.TypedConfig
			if strings.Contains(typedConfig.Cluster, "Cluster") {
				return typedConfig.Cluster
			} else {
				return fmt.Sprintf("Cluster: %s", typedConfig.Cluster)
			}
		}
	}
	return "Non-HTTP/Non-TCP"
}

func describeDomains(vh VirtualHostFilter) string {
	domains := vh.Domains
	if len(domains) == 1 && domains[0] == "*" {
		return ""
	}
	domainstr := make([]string, len(domains))
	for _, domain := range domains {
		domainstr = append(domainstr, domain)
	}
	return strings.Join(domainstr, "/")
}

func describeRoutes(vh VirtualHostFilter) string {
	routes := make([]string, 0, len(vh.Routes))
	for _, route := range vh.Routes {
		routes = append(routes, matchSummary(route.Match))
	}
	return strings.Join(routes, ", ")
}

func getMatchAllCluster(route *RouteConfig) string {
	vhs := route.VirtualHosts
	if len(vhs) != 1 {
		return ""
	}

	vh := vhs[0]
	domains := vh.Domains
	if !(len(domains) == 1 && domains[0] == "*") {
		return ""
	}

	if len(vh.Routes) != 1 {
		return ""
	}

	r := vh.Routes[0]
	if prefix, found := r.Match["prefix"]; found && prefix.(string) != "/" {
		return ""
	}

	if r.Route == nil || len(r.Route.Cluster) == 0 {
		return ""
	}

	if strings.Contains(r.Route.Cluster, "Cluster") {
		return r.Route.Cluster
	}

	return fmt.Sprintf("Cluster: %s", r.Route.Cluster)
}

func getAppDescriptor(chainMatch *FilterChainMatch) string {
	plainText := []string{"http/1.0", "http/1.1", "h2c"}
	istioPlainText := []string{"istio", "istio-http/1.0", "istio-http/1.1", "istio-h2"}
	httpTLS := []string{"http/1.0", "http/1.1", "h2c", "istio-http/1.0", "istio-http/1.1", "istio-h2"}
	tcpTLS := []string{"istio-peer-exchange", "istio"}

	protocolMap := map[string][]string{
		"App: HTTP TLS":         httpTLS,
		"App: Istio HTTP Plain": istioPlainText,
		"App: TCP TLS":          tcpTLS,
		"App: HTTP":             plainText,
	}

	if len(chainMatch.ApplicationProtocols) == 0 {
		return ""
	}

	for label, protList := range protocolMap {
		if len(protList) == len(chainMatch.ApplicationProtocols) {
			same := true
			for i, prot := range protList {
				same = same && prot == chainMatch.ApplicationProtocols[i]
			}
			if same {
				return label
			}
		}
	}

	return ""
}

func (css *Clusters) Parse(dump *kubernetes.ConfigDump) {
	clusterDumpRaw := dump.GetConfig("type.googleapis.com/envoy.admin.v3.ClustersConfigDump")
	var clusterDump ClusterDump
	err := mapstructure.Decode(clusterDumpRaw, &clusterDump)
	if err != nil {
		return
	}

	for _, clusterSet := range [][]EnvoyClusterWrapper{clusterDump.DynamicClusters, clusterDump.StaticClusters} {
		for _, cluster:= range clusterSet {
			cs := &Cluster{}
			cs.Parse(cluster.Cluster)
			*css = append(*css, cs)
		}
	}
}

func (cs *Cluster) Parse(cluster EnvoyCluster) {
	cs.ServiceFQDN = cluster.Name
	cs.Type = cluster.Type
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
		cs.DestinationRule = istioMetadata(cluster.Metadata)
	}
}

func (rs *Routes) Parse(dump *kubernetes.ConfigDump) {
	routesDumpRaw := dump.GetConfig("type.googleapis.com/envoy.admin.v3.RoutesConfigDump")
	var routesDump RouteDump
	err := mapstructure.Decode(routesDumpRaw, &routesDump)
	if err != nil {
		return
	}

	for _, routeSet := range [][]EnvoyRouteConfig{routesDump.DynamicRouteConfigs, routesDump.StaticRouteConfigs} {
		for _, route := range routeSet {
			rc := route.RouteConfig

			for _, vhs:= range rc.VirtualHosts {
				for _, route := range vhs.Routes {
					route := &Route{
						Name:           rc.Name,
						Domains:        bestDomainMatch(vhs.Domains),
						Match:          matchSummary(route.Match),
						VirtualService: istioMetadata(route.Metadata),
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

	if safeRegex, found := match["safe_regex"]; found {
		conds = append(conds, fmt.Sprintf("regex %s", safeRegex))
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
	for _, domain:= range domains {
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

func istioMetadata(metadata *EnvoyMetadata) string {
	if metadata == nil || metadata.FilterMetadata == nil || metadata.FilterMetadata.Istio == nil {
		return ""
	}

	return renderConfig(metadata.FilterMetadata.Istio.Config)
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
