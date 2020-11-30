package models

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
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

func (ls *Listeners) Parse(dump *kubernetes.ConfigDump) {
	listenersDump := dump.GetConfig("type.googleapis.com/envoy.admin.v3.ListenersConfigDump")

	dynamicListeners, ok := listenersDump["dynamic_listeners"]
	if !ok {
		log.Error("unexpected format of the config dump in the ListenersDump")
	}

	dl, ok := dynamicListeners.([]interface{})
	if !ok {
		log.Error("unexpected format of the config dump in the ListenersDump")
	}

	staticListeners, ok := listenersDump["static_listeners"]
	if !ok {
		log.Error("unexpected format of the config dump in the ListenersDump")
	}

	sl, ok := staticListeners.([]interface{})
	if !ok {
		log.Error("unexpected format of the config dump in the ListenersDump")
	}

	for _, listenerSet := range [][]interface{}{dl, sl} {
		for _, listenerRaw := range listenerSet {
			listenerGen, ok := listenerRaw.(map[string]interface{})
			if !ok {
				log.Error("unexpected format of the config dump in the ListenersDump")
			}

			activeState, found := listenerGen["active_state"].(map[string]interface{})
			if !found {
				activeState = listenerGen
			}

			listenerRaw := activeState["listener"].(map[string]interface{})
			addressRaw := listenerRaw["address"].(map[string]interface{})
			socketAddressRaw := addressRaw["socket_address"].(map[string]interface{})

			for _, match := range listenerMatches(listenerRaw) {
				*ls = append(*ls, &Listener{
					Address:     socketAddressRaw["address"].(string),
					Port:        socketAddressRaw["port_value"].(float64),
					Match:       match["match"].(string),
					Destination: match["destination"].(string),
				})
			}
		}
	}
}

func listenerMatches(listener map[string]interface{}) []map[string]interface{} {
	chains := listener["filter_chains"].([]interface{})
	if defaultFilterChain, found := listener["default_filter_chain"]; found {
		chains = append(chains, defaultFilterChain)
	}

	matches := make([]map[string]interface{}, 0, len(chains))
	for _, chainRaw := range chains {
		descriptors := make([]string, 0)

		chain := chainRaw.(map[string]interface{})
		chainMatchRaw, found := chain["filter_chain_match"]
		if !found {
			matches = append(matches, map[string]interface{}{"match": "ALL", "destination": getListenerDestination(chain["filters"])})
			continue
		}

		chainMatch := chainMatchRaw.(map[string]interface{})
		if snd := getChainDescriptor("server_names", "SNI", chainMatch); snd != "" {
			descriptors = append(descriptors, snd)
		}

		if apd := getAppDescriptor(chainMatch); apd != "" {
			descriptors = append(descriptors, apd)
		}

		if tp, found := chainMatch["transport_protocol"]; found {
			descriptors = append(descriptors, fmt.Sprintf("Trans: %s", tp))
		}

		port := ""
		if dp, found := chainMatch["destination_port"]; found {
			port = fmt.Sprintf(":%d", int(dp.(float64)))
		}

		preRanRaw, found := chainMatch["prefix_ranges"]
		if found {
			if prefixRanges, ok := preRanRaw.([]interface{}); ok && len(prefixRanges) > 0 {
				pfs := []string{}
				for _, p := range prefixRanges {
					if prefixRange, ok := p.(map[string]interface{}); ok {
						pfs = append(pfs, fmt.Sprintf("%s/%d", prefixRange["address_prefix"], int(prefixRange["prefix_len"].(float64))))
					}
				}
				descriptors = append(descriptors, fmt.Sprintf("Addr: %s%s", strings.Join(pfs, ","), port))
			}
		} else if port != "" {
			descriptors = append(descriptors, fmt.Sprintf("Addr: *%s", port))
		}

		match := strings.Join(descriptors, ";")
		if len(descriptors) == 0 {
			match = "ALL"
		}

		matches = append(matches, map[string]interface{}{
			"match":       match,
			"destination": getListenerDestination(chain["filters"]),
		})
	}
	return matches
}

func getListenerDestination(filtersRaw interface{}) string {
	filters, ok := filtersRaw.([]interface{})
	if !ok {
		return ""
	}

	for _, filterRaw := range filters {
		filter, ok := filterRaw.(map[string]interface{})
		if !ok {
			continue
		}

		if tcRaw, found := filter["typed_config"]; found {
			tc := tcRaw.(map[string]interface{})
			if filter["name"].(string) == "envoy.filters.network.http_connection_manager" {
				if routeConfigRaw, found := tc["route_config"]; found {
					routeConfig := routeConfigRaw.(map[string]interface{})
					if cluster := getMatchAllCluster(routeConfig); cluster != "" {
						return cluster
					}
					vhosts := []string{}
					for _, vh := range routeConfig["virtual_hosts"].([]interface{}) {
						if describeDomains(vh.(map[string]interface{})) == "" {
							vhosts = append(vhosts, describeRoutes(vh.(map[string]interface{})))
						} else {
							vhosts = append(vhosts, fmt.Sprintf("%s %s", describeDomains(vh.(map[string]interface{})), describeRoutes(vh.(map[string]interface{}))))
						}
					}
					return fmt.Sprintf("Inline Route: %s", strings.Join(vhosts, "; "))
				}

				if rdsRaw, found := tc["rds"]; found {
					rds := rdsRaw.(map[string]interface{})
					if rcn, found := rds["route_config_name"]; found {
						return fmt.Sprintf("Route: %s", rcn.(string))
					}
				}
				return "HTTP"
			} else if filter["name"].(string) == "envoy.filters.network.tcp_proxy" {
				if cluster, found := tc["cluster"]; found {
					if strings.Contains(cluster.(string), "Cluster") {
						return cluster.(string)
					} else {
						return fmt.Sprintf("Cluster: %s", cluster.(string))
					}
				}
			}
		}
	}
	return "Non-HTTP/Non-TCP"
}

func describeDomains(vh map[string]interface{}) string {
	domainsRaw, found := vh["domains"]
	if !found {
		return ""
	}
	domains, ok := domainsRaw.([]interface{})
	if !ok {
		return ""
	}
	if len(domains) == 1 && domains[0] == "*" {
		return ""
	}
	domainstr := make([]string, len(domains))
	for _, domain := range domains {
		domainstr = append(domainstr, domain.(string))
	}
	return strings.Join(domainstr, "/")
}

func describeRoutes(vh map[string]interface{}) string {
	routesRaw, ok := vh["routes"].([]interface{})
	if !ok {
		return ""
	}

	routes := make([]string, 0, len(routesRaw))
	for _, routeRaw := range routesRaw {
		if route, ok := routeRaw.(map[string]interface{}); ok {
			routes = append(routes, matchSummary(route["match"].(map[string]interface{})))
		}
	}
	return strings.Join(routes, ", ")
}

func getMatchAllCluster(route map[string]interface{}) string {
	vhsRaw, found := route["virtual_hosts"]
	if !found {
		return ""
	}

	vhs, ok := vhsRaw.([]interface{})
	if ok && len(vhs) != 1 {
		return ""
	}

	vh := vhs[0].(map[string]interface{})
	if domainsRaw, found := vh["domains"]; found {
		if domains, ok := domainsRaw.([]interface{}); ok && !(len(domains) == 1 && domains[0] == "*") {
			return ""
		}
	}

	routesRaw, found := vh["routes"]
	if !found {
		return ""
	}

	routes, ok := routesRaw.([]interface{})
	if !ok {
		return ""
	}

	if len(routes) != 1 {
		return ""
	}

	r, ok := routes[0].(map[string]interface{})
	if !ok {
		return ""
	}

	routeMatchRaw, found := r["match"]
	if !found {
		return ""
	}

	routeMatch, ok := routeMatchRaw.(map[string]interface{})
	if !ok {
		return ""
	}

	if prefix, found := routeMatch["prefix"]; found && prefix.(string) != "/" {
		return ""
	}

	routeActionRaw, found := r["route"]
	if !found {
		return ""
	}

	routeAction, ok := routeActionRaw.(map[string]interface{})
	if !ok {
		return ""
	}

	routeActionCluster, found := routeAction["cluster"]
	if !found {
		return ""
	}

	if strings.Contains(routeActionCluster.(string), "Cluster") {
		return routeActionCluster.(string)
	}

	return fmt.Sprintf("Cluster: %s", routeActionCluster)
}

func getAppDescriptor(chainMatch map[string]interface{}) string {
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

	apsRaw, found := chainMatch["application_protocols"]
	if !found {
		return ""
	}

	aps, ok := apsRaw.([]interface{})
	if !ok {
		return ""
	}

	for label, protList := range protocolMap {
		if len(protList) == len(aps) {
			same := true
			for i, prot := range protList {
				same = same && prot == aps[i].(string)
			}
			if same {
				return label
			}
		}
	}

	return ""
}

func getChainDescriptor(match, label string, chainMatch map[string]interface{}) string {
	result := ""
	if serverNames, found := chainMatch[match]; found {
		if sn, ok := serverNames.([]interface{}); ok && len(sn) > 0 {
			for i, desc := range sn {
				sns := desc.(string)
				if i > 0 {
					result = result + ","
				}
				result = result + sns
			}
			result = fmt.Sprintf("%s: %s", label, result)
		}
	}
	return result
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

	if safeRegex, found := match["safe_regex"]; found {
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
