package models

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
)

type EnvoyProxyDump struct {
	ConfigDump *kubernetes.ConfigDump `json:"config_dump,omitempty"`
	Bootstrap  *Bootstrap             `json:"bootstrap,omitempty"`
	Clusters   *Clusters              `json:"clusters,omitempty"`
	Listeners  *Listeners             `json:"listeners,omitempty"`
	Routes     *Routes                `json:"routes,omitempty"`
}

type Listeners []*Listener
type Listener struct {
	Address     string  `json:"address"`
	Port        float64 `json:"port"`
	Match       string  `json:"match"`
	Destination string  `json:"destination"`
}

type Clusters []*Cluster
type Cluster struct {
	ServiceFQDN     kubernetes.Host `json:"service_fqdn"`
	Port            int             `json:"port"`
	Subset          string          `json:"subset"`
	Direction       string          `json:"direction"`
	Type            string          `json:"type"`
	DestinationRule string          `json:"destination_rule"`
}

type Routes []*Route
type Route struct {
	Name           string          `json:"name"`
	Domains        kubernetes.Host `json:"domains"`
	Match          string          `json:"match"`
	VirtualService string          `json:"virtual_service"`
}

type Bootstrap struct {
	Bootstrap map[string]interface{} `json:"bootstrap,inline"`
}

func (ls *Listeners) Parse(dump *kubernetes.ConfigDump) error {
	listenersDump, err := dump.GetListeners()
	if err != nil {
		return err
	}
	listeners := make([]kubernetes.EnvoyListener, 0, len(listenersDump.StaticListeners)+len(listenersDump.DynamicListeners))
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
	return nil
}

func listenerMatches(listener kubernetes.EnvoyListener) []map[string]interface{} {
	chains := listener.FilterChains
	if listener.DefaultFilterChain != nil {
		chains = append(chains, *listener.DefaultFilterChain)
	}

	matches := make([]map[string]interface{}, 0, len(chains))
	for _, chain := range chains {
		descriptors := make([]string, 0)

		match := chain.FilterChainMatch
		if match == nil {
			match = &kubernetes.FilterChainMatch{}
		}

		if len(match.ServerNames) > 0 {
			descriptors = append(descriptors, fmt.Sprintf("SNI: %s", strings.Join(match.ServerNames, ", ")))
		}

		if len(match.TransportProtocol) > 0 {
			descriptors = append(descriptors, fmt.Sprintf("Trans: %s", match.TransportProtocol))
		}

		if apd := getAppDescriptor(match); apd != "" {
			descriptors = append(descriptors, apd)
		}

		port := ""
		if match.DestinationPort != nil {
			port = fmt.Sprintf(":%d", *match.DestinationPort)
		}

		if len(match.PrefixRanges) > 0 {
			pfs := []string{}
			for _, p := range match.PrefixRanges {
				pfs = append(pfs, fmt.Sprintf("%s/%d", p.AddressPrefix, p.PrefixLen))
			}
			descriptors = append(descriptors, fmt.Sprintf("Addr: %s%s", strings.Join(pfs, ", "), port))
		} else if port != "" {
			descriptors = append(descriptors, fmt.Sprintf("Addr: *%s", port))
		}

		if len(descriptors) == 0 {
			descriptors = []string{"ALL"}
		}

		matches = append(matches, map[string]interface{}{
			"match":       strings.Join(descriptors, "; "),
			"destination": getListenerDestination(chain.Filters),
		})
	}
	return matches
}

func getListenerDestination(filters []kubernetes.EnvoyListenerFilter) string {
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

func describeDomains(vh kubernetes.VirtualHostFilter) string {
	domains := vh.Domains
	if len(domains) == 1 && domains[0] == "*" {
		return ""
	}
	return strings.Join(domains, "/")
}

func describeRoutes(vh kubernetes.VirtualHostFilter) string {
	routes := make([]string, 0, len(vh.Routes))
	for _, route := range vh.Routes {
		routes = append(routes, matchSummary(route.Match))
	}
	return strings.Join(routes, ", ")
}

func getMatchAllCluster(route *kubernetes.RouteConfig) string {
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

func getAppDescriptor(chainMatch *kubernetes.FilterChainMatch) string {
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

func (css *Clusters) Parse(dump *kubernetes.ConfigDump, conf *config.Config) error {
	clusterDump, err := dump.GetClusters()
	if err != nil {
		return err
	}

	for _, clusterSet := range [][]kubernetes.EnvoyClusterWrapper{clusterDump.DynamicClusters, clusterDump.StaticClusters} {
		for _, cluster := range clusterSet {
			cs := &Cluster{}
			cs.Parse(cluster.Cluster, conf)
			*css = append(*css, cs)
		}
	}

	return nil
}

func (cs *Cluster) Parse(cluster kubernetes.EnvoyCluster, conf *config.Config) {
	cs.ServiceFQDN = kubernetes.Host{Service: cluster.Name}
	cs.Type = cluster.Type
	cs.Port = 0
	cs.Subset = ""
	cs.Direction = ""
	cs.DestinationRule = ""

	parts := strings.Split(cluster.Name, "|")
	if len(parts) > 3 {
		cs.ServiceFQDN = kubernetes.ParseHost(parts[3], "", conf)
		cs.Port, _ = strconv.Atoi(strings.TrimSuffix(parts[1], "_"))
		cs.Subset = parts[2]
		cs.Direction = strings.TrimSuffix(parts[0], "_")
		cs.DestinationRule = istioMetadata(cluster.Metadata)
	}
}

func (rs *Routes) Parse(dump *kubernetes.ConfigDump, namespaces []string, conf *config.Config) error {
	routesDump, err := dump.GetRoutes()
	if err != nil {
		return err
	}

	for _, routeSet := range [][]kubernetes.EnvoyRouteConfig{routesDump.DynamicRouteConfigs, routesDump.StaticRouteConfigs} {
		for _, route := range routeSet {
			rc := route.RouteConfig

			for _, vhs := range rc.VirtualHosts {
				for _, r := range vhs.Routes {
					if r.Route != nil && r.Route.Cluster != "PassthroughCluster" {
						*rs = append(*rs, &Route{
							Name:           rc.Name,
							Domains:        bestDomainMatch(vhs.Domains, namespaces, conf),
							Match:          matchSummary(r.Match),
							VirtualService: istioMetadata(r.Metadata),
						})
					}
				}

				if len(vhs.Routes) == 0 {
					*rs = append(*rs, &Route{
						Name:           rc.Name,
						Domains:        bestDomainMatch(vhs.Domains, namespaces, conf),
						Match:          "/*",
						VirtualService: "404",
					})
				}
			}
		}
	}

	return nil
}

func (bd *Bootstrap) Parse(dump *kubernetes.ConfigDump) error {
	bd.Bootstrap = dump.GetConfig("type.googleapis.com/envoy.admin.v3.BootstrapConfigDump")
	return nil
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

func bestDomainMatch(domains []string, namespaces []string, conf *config.Config) kubernetes.Host {
	if len(domains) == 0 {
		return kubernetes.Host{Service: ""}
	}

	if len(domains) == 1 {
		return kubernetes.GetHost(domains[0], "", namespaces, conf)
	}

	bestMatch := domains[0]
	for _, domain := range domains {
		if len(domain) == 0 {
			continue
		}

		firstChar := domain[0]
		if firstChar >= '1' && firstChar <= '9' {
			continue
		}

		if len(bestMatch) > len(domain) {
			bestMatch = domain
		}
	}
	return kubernetes.GetHost(bestMatch, "", namespaces, conf)
}

func istioMetadata(metadata *kubernetes.EnvoyMetadata) string {
	if metadata == nil || metadata.FilterMetadata == nil || metadata.FilterMetadata.Istio == nil {
		return ""
	}

	return renderConfig(metadata.FilterMetadata.Istio.Config)
}

func renderConfig(configPath string) string {
	if strings.HasPrefix(configPath, "/apis/networking.istio.io/v1/namespaces/") {
		parts := strings.Split(configPath, "/")
		if len(parts) != 8 {
			return ""
		}
		return fmt.Sprintf("%s.%s", parts[7], parts[5])
	}
	return ""
}
