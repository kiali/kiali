package handlers

// Graph.go provides handlers for service-graph request endpoints.   The handlers return configuration
// for a specified vendor (default cytoscape).  The configuration format is vendor-specific, typically
// JSON, and provides what is necessary to allow the vendor's graphing tool to render the service graph.
//
// The algorithm is three-pass:
//   First Pass: Query Prometheus (istio-request-count metric) to retrieve the source-destination
//               service dependencies. Build trees rooted at request entry points that together
//               provide a full representation of nodes and edges.  The trees avoid circularities
//               and redundancies.
//
//   Second Pass: Apply any requested appenders to append information to the graph.
//
//   Third Pass: Supply the trees to a vendor-specific config generator that walks the trees and
//               constructs the vendor-specific output.
//
// The current Handlers:
//   GraphNamespace:  Generate a graph for all services in a namespace (whether source or destination)
//   GraphService:    Generate a graph centered on versions of a specified service, limited to
//                    requesting and requested services.
//
// The handlers accept the following query parameters (some handlers may ignore some parameters):
//   duration:       time.Duration indicating desired query range duration, (default 10m)
//   appenders:      Comma-separated list of appenders to run from [circuit_breaker, unused_service] (default all)
//                   Note, appenders may support appender-specific query parameters
//   groupByVersion: If supported by vendor, visually group versions of the same service (default true)
//   includeIstio:   Include istio-system (infra) services (default false)
//   metric:         Prometheus metric name to be used to generate the dependency graph (default istio_request_count)
//   namespaces:     Comma-separated list of namespace names to use in the graph. Will override namespace path param
//   queryTime:      Unix time (seconds) for query such that range is queryTime-duration..queryTime (default now)
//   vendor:         cytoscape | vizceral (default cytoscape)
//
// * Error% is the percentage of requests with response code != 2XX
// * See the vendor-specific config generators for more details about the specific vendor.
//
import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"runtime/debug"
	"sort"
	"strings"
	"time"

	"github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"

	"github.com/kiali/kiali/graph/cytoscape"
	"github.com/kiali/kiali/graph/options"
	"github.com/kiali/kiali/graph/tree"
	"github.com/kiali/kiali/graph/vizceral"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
)

// GraphNamespace is a REST http.HandlerFunc handling namespace-wide servicegraph
// config generation.
func GraphNamespace(w http.ResponseWriter, r *http.Request) {
	defer handlePanic(w)

	client, err := prometheus.NewClient()
	checkError(err)

	graphNamespace(w, r, client)
}

// graphNamespace provides a testing hook that can supply a mock client
func graphNamespace(w http.ResponseWriter, r *http.Request, client *prometheus.Client) {
	o := options.NewOptions(r)
	roots := graphNamespaces(o, client)
	generateGraph(roots, w, o)
}

func graphNamespaces(o options.Options, client *prometheus.Client) *[]*tree.ServiceNode {
	switch o.Vendor {
	case "cytoscape":
	case "vizceral":
	default:
		checkError(errors.New(fmt.Sprintf("Vendor [%v] does not support Namespace Graphs", o.Vendor)))
	}

	log.Debugf("Build graph for [%v] namespaces [%s]", len(o.Namespaces), o.Namespaces)

	roots := []*tree.ServiceNode{}
	for _, namespace := range o.Namespaces {
		log.Debugf("Build graph for namespace [%s]", namespace)
		namespaceRoots := buildNamespaceTrees(namespace, o, client)

		for _, a := range o.Appenders {
			a.AppendGraph(namespaceRoots, namespace)
		}
		mergeRoots(&roots, namespaceRoots)
	}

	if len(o.Namespaces) > 0 {
		mergeNamespaces(&roots)
	}

	return &roots
}

// mergeRoots ensures that we only have unique root nodes by removing duplicate roots
// and merging their children.
func mergeRoots(roots, namespaceRoots *[]*tree.ServiceNode) {
	for _, nsr := range *namespaceRoots {
		merged := false
		for _, r := range *roots {
			if r.ID == nsr.ID {
				r.Children = append(r.Children, nsr.Children...)
				merged = true
				log.Debugf("Merged duplicate root node [%s]", r.ID)
				break
			}
		}
		if !merged {
			*roots = append(*roots, nsr)
		}
	}
}

// mergeNamespaces ties together namespaces to avoid duplicate edges. A duplicate can
// occur when an edge node of one namespace is a root node of another.  For example:
//   ns1 graph: unknown -> ns1:A -> ns2:B
//   ns2 graph:   ns1:A -> ns2:B -> ns2:C
//
// The edge ns1:A -> ns2:B is duplicated in each graph because ns1:A is an edge node of
// ns1 and makes requests out of the namespace to leaf node ns2:B.  That will make ns1:A
// a root node for the ns2 graph.  When the same node is a leaf and a root we can have
// duplicate edges.  In this case we remove the leaf node in the combined graph.
func mergeNamespaces(roots *[]*tree.ServiceNode) {
	edgeNodes := make(map[string]*tree.ServiceNode) // nodes leading to child outside namespace
	for _, r := range *roots {
		collectEdgeNodes(r, edgeNodes)
	}

	for _, r := range *roots {
		if edge, ok := edgeNodes[r.ID]; ok {
			for i := len(edge.Children) - 1; i >= 0; i-- {
				if containsNode(edge.Children[i], &r.Children) {
					log.Debugf("Removing child [%s] from edge [%s] because it is found under root [%s]", edge.Children[i].ID, edge.ID, r.ID)
					edge.Children = append(edge.Children[:i], edge.Children[i+1:]...)
				}
			}
		}
	}
}

func collectEdgeNodes(node *tree.ServiceNode, edgeNodes map[string]*tree.ServiceNode) {
	if len(node.Children) == 0 && node.Metadata["isOutsideNamespace"] == "true" {
		edgeNodes[node.Parent.ID] = node.Parent
	} else {
		for _, c := range node.Children {
			collectEdgeNodes(c, edgeNodes)
		}
	}
}

func containsNode(target *tree.ServiceNode, nodes *[]*tree.ServiceNode) bool {
	for _, node := range *nodes {
		if target.ID == node.ID {
			return true
		}
	}
	return false
}

// buildNamespaceTrees returns trees rooted at services receiving requests from outside the namespace
func buildNamespaceTrees(namespace string, o options.Options, client *prometheus.Client) (trees *[]*tree.ServiceNode) {
	// avoid circularities by keeping track of all seen nodes
	seenNodes := make(map[string]*tree.ServiceNode)

	// Query for root nodes. Root nodes must originate outside of the requested
	// namespace.  Destination nodes must be in the namespace.
	namespacePattern := fmt.Sprintf(".*\\\\.%v\\\\..*", namespace)
	query := fmt.Sprintf("sum(rate(%v{source_service!~\"%v\",destination_service=~\"%v\",response_code=~\"%v\"} [%vs])) by (%v)",
		o.Metric,
		namespacePattern,                // regex for namespace-constrained service
		namespacePattern,                // regex for namespace-constrained service
		"[2345][0-9][0-9]",              // regex for valid response_codes
		int(o.Duration.Seconds()),       // range duration for the query
		"source_service,source_version") // group by

	// fetch the root time series
	vector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())

	// generate a tree rooted at each source node
	trees = &[]*tree.ServiceNode{}

	for _, s := range vector {
		m := s.Metric
		sourceSvc, sourceSvcOk := m["source_service"]
		sourceVer, sourceVerOk := m["source_version"]
		if !sourceSvcOk || !sourceVerOk {
			log.Warningf("Skipping %v, missing expected labels", m.String())
			continue
		}

		md := make(map[string]interface{})
		md["isRoot"] = "true"

		root := tree.NewServiceNode(string(sourceSvc), string(sourceVer))
		root.Parent = nil
		root.Metadata = md

		seenNodes[root.ID] = &root

		log.Debugf("Building namespace tree for Root ServiceNode: %v\n", root.ID)
		buildNamespaceTree(namespace, &root, time.Unix(o.QueryTime, 0), seenNodes, o, client)

		*trees = append(*trees, &root)
	}

	return trees
}

func buildNamespaceTree(namespace string, sn *tree.ServiceNode, start time.Time, seenNodes map[string]*tree.ServiceNode, o options.Options, client *prometheus.Client) {
	log.Debugf("Adding children for ServiceNode: %v\n", sn.ID)

	var destinationSvcFilter string
	if !strings.Contains(sn.Name, namespace) {
		destinationSvcFilter = fmt.Sprintf(",destination_service=~\".*\\\\.%v\\\\..*\"", namespace)
	}
	query := fmt.Sprintf("sum(rate(%v{source_service=\"%v\",source_version=\"%v\"%v,response_code=~\"%v\"} [%vs])) by (%v)",
		o.Metric,
		sn.Name,                                                 // parent service name
		sn.Version,                                              // parent service version
		destinationSvcFilter,                                    // regex for namespace-constrained destination service
		"[2345][0-9][0-9]",                                      // regex for valid response_codes
		int(o.Duration.Seconds()),                               // range duration for the query
		"destination_service,destination_version,response_code") // group by

	vector := promQuery(query, start, client.API())

	// identify the unique destination services
	destinations := toDestinations(sn.Name, sn.Version, vector)

	sn.Metadata["rateOut"] = 0.0
	if len(destinations) > 0 {
		sn.Children = []*tree.ServiceNode{}
		for k, d := range destinations {
			s := strings.Split(k, " ")
			serviceName := s[0]
			serviceVersion := s[1]

			if !o.IncludeIstio && strings.Contains(serviceName, options.NamespaceIstioSystem) {
				continue
			}

			child := tree.NewServiceNode(serviceName, serviceVersion)
			child.Parent = sn
			child.Metadata = d

			sn.Metadata["rateOut"] = sn.Metadata["rateOut"].(float64) + d["rate"].(float64)

			log.Debugf("Adding child Service: %v(%v)->%v(%v)\n", sn.Name, sn.Version, child.Name, child.Version)
			sn.Children = append(sn.Children, &child)
		}
		// sort children for better presentation (and predictable testing)
		sort.Slice(sn.Children, func(i, j int) bool {
			return sn.Children[i].ID < sn.Children[j].ID
		})
		for _, child := range sn.Children {
			if _, seen := seenNodes[child.ID]; !seen {
				seenNodes[child.ID] = child
				if strings.Contains(child.Name, namespace) {
					buildNamespaceTree(namespace, child, start, seenNodes, o, client)
				} else {
					log.Debugf("Not recursing on child service %v(%v) outside of namespace [%s]\n", child.Name, child.Version, namespace)
					child.Metadata["isOutsideNamespace"] = "true"
				}
			} else {
				log.Debugf("Not recursing on seen child service: %v(%v)\n", child.Name, child.Version)
			}
		}
	}
}

// GraphService is a REST http.HandlerFunc handling service-specific servicegraph config generation.
func GraphService(w http.ResponseWriter, r *http.Request) {
	defer handlePanic(w)

	client, err := prometheus.NewClient()
	checkError(err)

	graphService(w, r, client)
}

// graphService provides a testing hook that can supply a mock client
func graphService(w http.ResponseWriter, r *http.Request, client *prometheus.Client) {
	o := options.NewOptions(r)

	switch o.Vendor {
	case "cytoscape":
	default:
		checkError(errors.New(fmt.Sprintf("Vendor [%v] does not support Service Graphs", o.Vendor)))
	}

	log.Debugf("Build roots (root services nodes) for [%v] service graph with options [%+v]", o.Vendor, o)

	trees := buildServiceTrees(o, client)

	generateGraph(&trees, w, o)
}

// buildServiceTrees returns trees routed at source services for versions of the service of interest
func buildServiceTrees(o options.Options, client *prometheus.Client) (trees []*tree.ServiceNode) {
	// Query for root nodes. Root nodes for the service graph represent
	// services requesting the specified destination services in the namespace.
	query := fmt.Sprintf("sum(rate(%v{destination_service=~\"%v\",response_code=~\"%v\"} [%vs])) by (%v)",
		o.Metric,
		fmt.Sprintf("%v\\\\.%v\\\\..*", o.Service, o.Namespaces[0]), // regex for namespace-constrained destination service
		"[2345][0-9][0-9]",                                          // regex for valid response_codes
		int(o.Duration.Seconds()),                                   // range duration for the query
		"source_service, source_version")                            // group by

	// avoid circularities by keeping track of seen nodes
	seenNodes := make(map[string]*tree.ServiceNode)

	// fetch the root time series
	vector := promQuery(query, time.Unix(o.QueryTime, 0), client.API())

	// generate a tree rooted at each top-level destination
	trees = []*tree.ServiceNode{}

	for _, s := range vector {
		m := s.Metric
		sourceSvc, sourceSvcOk := m["source_service"]
		sourceVer, sourceVerOk := m["source_version"]
		if !sourceSvcOk || !sourceVerOk {
			log.Warningf("Skipping %v, missing expected labels", m.String())
			continue
		}
		if strings.HasPrefix(string(sourceSvc), o.Service) {
			log.Warningf("Skipping %v, self-referential root", m.String())
			continue
		}

		rootService := string(sourceSvc)
		rootVersion := string(sourceVer)
		md := make(map[string]interface{})

		root := tree.NewServiceNode(rootService, rootVersion)
		root.Parent = nil
		root.Metadata = md

		seenNodes[root.ID] = &root

		log.Debugf("Building service tree for Root ServiceNode: %v\n", root.ID)
		buildServiceSubtree(&root, o.Service, time.Unix(o.QueryTime, 0), seenNodes, o, client)
		trees = append(trees, &root)
	}

	return trees
}

func buildServiceSubtree(sn *tree.ServiceNode, destinationSvc string, queryTime time.Time, seenNodes map[string]*tree.ServiceNode, o options.Options, client *prometheus.Client) {
	log.Debugf("Adding children for ServiceNode: %v\n", sn.ID)

	var destinationSvcFilter string
	if "" == destinationSvc {
		destinationSvcFilter = fmt.Sprintf(".*\\\\.%v\\\\..*", o.Namespaces[0])
	} else {
		destinationSvcFilter = fmt.Sprintf("%v\\\\.%v\\\\..*", o.Service, o.Namespaces[0])
	}
	query := fmt.Sprintf("sum(rate(%v{source_service=\"%v\",source_version=\"%v\",destination_service=~\"%v\",response_code=~\"%v\"} [%vs])) by (%v)",
		o.Metric,
		sn.Name,
		sn.Version,
		destinationSvcFilter,                                    // regex for destination service
		"[2345][0-9][0-9]",                                      // regex for valid response_codes
		int(o.Duration.Seconds()),                               // range duration for the query
		"destination_service,destination_version,response_code") // group by

	// fetch the root time series
	vector := promQuery(query, queryTime, client.API())

	// identify the unique destination services
	destinations := toDestinations(sn.Name, sn.Version, vector)

	sn.Metadata["rateOut"] = 0.0
	if len(destinations) > 0 {
		sn.Children = []*tree.ServiceNode{}
		for k, d := range destinations {
			s := strings.Split(k, " ")
			serviceName := s[0]
			serviceVersion := s[1]

			if !o.IncludeIstio && strings.Contains(serviceName, options.NamespaceIstioSystem) {
				continue
			}

			child := tree.NewServiceNode(serviceName, serviceVersion)
			child.Parent = sn
			child.Metadata = d

			sn.Metadata["rateOut"] = sn.Metadata["rateOut"].(float64) + d["rate"].(float64)

			log.Debugf("Child Service: %v(%v)->%v(%v)\n", sn.Name, sn.Version, child.Name, child.Version)
			sn.Children = append(sn.Children, &child)
		}
		// sort children for better presentation (and predictable testing)
		sort.Slice(sn.Children, func(i, j int) bool {
			return sn.Children[i].ID < sn.Children[j].ID
		})
		for _, child := range sn.Children {
			if _, seen := seenNodes[child.ID]; !seen {
				seenNodes[child.ID] = child
				if "" != destinationSvc {
					buildServiceSubtree(child, "", queryTime, seenNodes, o, client)
				}
			} else {
				log.Debugf("Not recursing on seen child service: %v(%v)\n", child.Name, child.Version)
			}
		}
	}
}

func generateGraph(trees *[]*tree.ServiceNode, w http.ResponseWriter, o options.Options) {
	log.Debugf("Generating config for [%v] service graph...", o.Vendor)

	var vendorConfig interface{}
	switch o.Vendor {
	case "vizceral":
		vendorConfig = vizceral.NewConfig(fmt.Sprintf("%v", o.Namespaces), trees, o.VendorOptions)
	case "cytoscape":
		vendorConfig = cytoscape.NewConfig(trees, o.VendorOptions)
	}

	log.Debugf("Done generating config for [%v] service graph.", o.Vendor)
	RespondWithJSONIndent(w, http.StatusOK, vendorConfig)
}

type Destination map[string]interface{}

// toDestinations takes a slice of [istio] series and returns a map K => D
// key = "destSvc destVersion"
// val = Destination (map) with the following keys, rates are requestRatePerSecond
//          source_svc   string
//          source_ver   string
//          rate     float64
//          rate_2xx float64
//          rate_3xx float64
//          rate_4xx float64
//          rate_5xx float64
func toDestinations(sourceSvc, sourceVer string, vector model.Vector) (destinations map[string]Destination) {
	destinations = make(map[string]Destination)
	for _, s := range vector {
		m := s.Metric
		destSvc, destSvcOk := m["destination_service"]
		destVer, destVerOk := m["destination_version"]
		code, codeOk := m["response_code"]
		if !destSvcOk || !destVerOk || !codeOk {
			log.Warningf("Skipping %v, missing expected labels", m.String())
		}

		if destSvcOk && destVerOk {
			k := fmt.Sprintf("%v %v", destSvc, destVer)
			dest, destOk := destinations[k]
			if !destOk {
				dest = Destination(make(map[string]interface{}))
				dest["source_svc"] = sourceSvc
				dest["source_ver"] = sourceVer
				dest["rate"] = 0.0
				dest["rate_2xx"] = 0.0
				dest["rate_3xx"] = 0.0
				dest["rate_4xx"] = 0.0
				dest["rate_5xx"] = 0.0
			}
			val := float64(s.Value)
			var ck string
			switch {
			case strings.HasPrefix(string(code), "2"):
				ck = "rate_2xx"
			case strings.HasPrefix(string(code), "3"):
				ck = "rate_3xx"
			case strings.HasPrefix(string(code), "4"):
				ck = "rate_4xx"
			case strings.HasPrefix(string(code), "5"):
				ck = "rate_5xx"
			}
			dest[ck] = dest[ck].(float64) + val
			dest["rate"] = dest["rate"].(float64) + val

			destinations[k] = dest
		}
	}
	return destinations
}

// TF is the TimeFormat for printing timestamp
const TF = "2006-01-02 15:04:05"

func promQuery(query string, queryTime time.Time, api v1.API) model.Vector {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// wrap with a round() to be in line with metrics api
	query = fmt.Sprintf("round(%s,0.001)", query)
	log.Debugf("Executing query %s&time=%v (now=%v, %v)\n", query, queryTime.Format(TF), time.Now().Format(TF), queryTime.Unix())

	value, err := api.Query(ctx, query, queryTime)
	checkError(err)

	switch t := value.Type(); t {
	case model.ValVector: // Instant Vector
		return value.(model.Vector)
	default:
		checkError(errors.New(fmt.Sprintf("No handling for type %v!\n", t)))
	}

	return nil
}

func checkError(err error) {
	if err != nil {
		panic(err.Error)
	}
}

func handlePanic(w http.ResponseWriter) {
	if r := recover(); r != nil {
		var message string
		switch r.(type) {
		case string:
			message = r.(string)
		case error:
			message = r.(error).Error()
		case func() string:
			message = r.(func() string)()
		default:
			message = fmt.Sprintf("%v", r)
		}
		log.Errorf("%s: %s", message, debug.Stack())
		RespondWithError(w, http.StatusInternalServerError, message)
	}
}

// some debugging utils
//func ids(r *[]tree.ServiceNode) []string {
//	s := []string{}
//	for _, r := range *r {
//		s = append(s, r.ID)
//	}
//	return s
//}

//func keys(m map[string]*tree.ServiceNode) []string {
//	s := []string{}
//	for k := range m {
//		s = append(s, k)
//	}
//	return s
//}
