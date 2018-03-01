package handlers

// Graph.go provides handlers for service-graph request endpoints.   The handlers return configuration
// for a specified vendor (default cytoscape).  The configuration format is vendor-specific, typically
// JSON, and provides what is necessary to allow the vendor's graphing tool to render the service graph.
//
// The algorithm is two-pass:
//   First Pass: Query Prometheus (istio-request-count metric) to retrieve the source-destination
//               service dependencies. Build trees rooted at request entry points that together
//               provide a full representation of nodes and edges.  The trees avoid circularities
//               and redundancies.
//
//   Second Pass: Supply the trees to a vendor-specific config generator that walks the trees and
//               constructs the vendor-specific output.
//
// The current Handlers:
//   GraphNamespace:  Generate a graph for all services in a namespace
//   GraphService:    Generate a graph centered on versions of a specified service, limited to
//                    requesting and requested services.
//
// The handlers accept the following query parameters:
//   vendor:         cytoscape | vizceral (default cytoscape)
//   metric:         Prometheus metric name to be used to generate the dependency graph (default istio_request_count)
//   groupByVersion: If supported by vendor, visually group versions of the same service (default true)
//   offset:         Duration indicating desired query offset (default 0m)
//   interval:       Duration indicating desired query period (default 30s)
//
// See the vendor-specific config generators for more details about the specific vendor.
//
import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"

	"github.com/swift-sunshine/swscore/graph/cytoscape"
	"github.com/swift-sunshine/swscore/graph/tree"
	"github.com/swift-sunshine/swscore/graph/vizceral"
	"github.com/swift-sunshine/swscore/log"
	"github.com/swift-sunshine/swscore/prometheus"
)

// options:
//  namespace:      narrow graphs to services in this namespace (required)
//  service:        narrow graphs to service (optional, no default)
//  vendor:         cytoscape | vizceral (default cytoscape)
//  metric:         Prometheus metric name to be used to generate the dependency graph (default=istio_request_count)
//  groupByVersion: If supported by vendor, visually group versions of the same service
//  offset:         Duration indicating desired query offset (default 0m)
//  interval:       Duration indicating desired query period (default 30s)
type options struct {
	namespace      string
	service        string
	vendor         string
	metric         string
	groupByVersion bool
	offset         time.Duration
	interval       time.Duration
}

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
	o := parseRequest(r)

	switch o.vendor {
	case "cytoscape":
	case "vizceral":
	default:
		checkError(errors.New(fmt.Sprintf("Vendor [%v] does not support Namespace Graphs", o.vendor)))
	}

	log.Debugf("Build roots (root destination services nodes) for [%v] namespace graph with options [%+v]", o.vendor, o)

	trees := buildNamespaceTrees(o, client)

	generateGraph(&trees, w, o)
}

// buildNamespaceTrees returns trees routed at all destination services with "Internet" parents
func buildNamespaceTrees(o options, client *prometheus.Client) (trees []tree.ServiceNode) {
	queryTime := time.Now()
	if o.offset.Seconds() > 0 {
		queryTime = queryTime.Add(-o.offset)
	}

	// avoid circularities by keeping track of all seen nodes
	seenNodes := make(map[string]*tree.ServiceNode)

	// Query for root nodes. Root nodes for the namespace graph represent external
	// requests (basically the internet) to destination services in the namespace.
	// The service has label "source_version" == "unknown", which indicates that
	// the request came from either an unknown or ingress source.
	query := fmt.Sprintf("sum(rate(%v{source_version=\"unknown\",destination_service=~\"%v\",response_code=~\"%v\"} [%vs])) by (%v)",
		o.metric,
		fmt.Sprintf(".*\\\\.%v\\\\..*", o.namespace), // regex for namespace-constrained destination service
		"[2345][0-9][0-9]",                           // regex for valid response_codes
		o.interval.Seconds(),                         // rate for the entire query period
		"source_service")                             // group by

	// fetch the root time series
	vector := promQuery(query, queryTime, client.API())

	// generate a tree rooted at each source node
	trees = []tree.ServiceNode{}

	for _, s := range vector {
		m := s.Metric
		sourceSvc, sourceSvcOk := m["source_service"]
		if !sourceSvcOk {
			log.Warningf("Skipping %v, missing expected labels", m.String())
		}

		rootService := string(sourceSvc)
		md := make(map[string]interface{})
		md["link_prom_graph"] = linkPromGraph(client.Address(), o.metric, rootService, tree.UnknownVersion)

		root := tree.NewServiceNode(rootService, tree.UnknownVersion)
		root.Parent = nil
		root.Metadata = md

		seenNodes[root.ID] = &root

		log.Debugf("Building namespace tree for Root ServiceNode: %v\n", root.ID)
		buildNamespaceTree(&root, queryTime, seenNodes, o, client)

		trees = append(trees, root)
	}

	return trees
}

func buildNamespaceTree(sn *tree.ServiceNode, start time.Time, seenNodes map[string]*tree.ServiceNode, o options, client *prometheus.Client) {
	log.Debugf("Adding children for ServiceNode: %v\n", sn.ID)

	var destinationSvcFilter string
	if !strings.Contains(sn.Name, o.namespace) {
		destinationSvcFilter = fmt.Sprintf(",destination_service=~\".*\\\\.%v\\\\..*\"", o.namespace)
	}
	query := fmt.Sprintf("sum(rate(%v{source_service=\"%v\",source_version=\"%v\"%v,response_code=~\"%v\"} [%vs]) * 60) by (%v)",
		o.metric,
		sn.Name,                                                 // parent service name
		sn.Version,                                              // parent service version
		destinationSvcFilter,                                    // regex for namespace-constrained destination service
		"[2345][0-9][0-9]",                                      // regex for valid response_codes
		o.interval.Seconds(),                                    // rate over the entire query period
		"destination_service,destination_version,response_code") // group by

	vector := promQuery(query, start, client.API())

	// identify the unique destination services
	destinations := toDestinations(sn.Name, sn.Version, vector)

	if len(destinations) > 0 {
		sn.Children = make([]*tree.ServiceNode, len(destinations))
		i := 0
		for k, d := range destinations {
			s := strings.Split(k, " ")
			d["link_prom_graph"] = linkPromGraph(client.Address(), o.metric, s[0], s[1])
			child := tree.NewServiceNode(s[0], s[1])
			child.Parent = sn
			child.Metadata = d

			log.Debugf("Adding child Service: %v(%v)->%v(%v)\n", sn.Name, sn.Version, child.Name, child.Version)
			sn.Children[i] = &child
			i++
		}
		// sort children for better presentation (and predictable testing)
		sort.Slice(sn.Children, func(i, j int) bool {
			return sn.Children[i].ID < sn.Children[j].ID
		})
		for _, child := range sn.Children {
			if _, seen := seenNodes[child.ID]; !seen {
				seenNodes[child.ID] = child
				buildNamespaceTree(child, start, seenNodes, o, client)
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
	o := parseRequest(r)

	switch o.vendor {
	case "cytoscape":
	default:
		checkError(errors.New(fmt.Sprintf("Vendor [%v] does not support Service Graphs", o.vendor)))
	}

	log.Debugf("Build roots (root destination services nodes) for [%v] service graph with options [%+v]", o.vendor, o)

	trees := buildServiceTrees(o, client)

	generateGraph(&trees, w, o)
}

// buildServiceTrees returns trees routed at source services for versions of the service of interest
func buildServiceTrees(o options, client *prometheus.Client) (trees []tree.ServiceNode) {
	queryTime := time.Now()
	if o.offset.Seconds() > 0 {
		queryTime = queryTime.Add(-o.offset)
	}

	// Query for root nodes. Root nodes for the service graph represent
	// services requesting the specified destination services in the namespace.
	query := fmt.Sprintf("sum(rate(%v{destination_service=~\"%v\",response_code=~\"%v\"} [%vs])) by (%v)",
		o.metric,
		fmt.Sprintf("%v\\\\.%v\\\\..*", o.service, o.namespace), // regex for namespace-constrained destination service
		"[2345][0-9][0-9]",                                      // regex for valid response_codes
		o.interval.Seconds(),                                    // rate for the entire query period
		"source_service, source_version")                        // group by

	// avoid circularities by keeping track of seen nodes
	seenNodes := make(map[string]*tree.ServiceNode)

	// fetch the root time series
	vector := promQuery(query, queryTime, client.API())

	// generate a tree rooted at each top-level destination
	trees = []tree.ServiceNode{}

	for _, s := range vector {
		m := s.Metric
		sourceSvc, sourceSvcOk := m["source_service"]
		sourceVer, sourceVerOk := m["source_version"]
		if !sourceSvcOk || !sourceVerOk {
			log.Warningf("Skipping %v, missing expected labels", m.String())
			continue
		}
		if strings.HasPrefix(string(sourceSvc), o.service) {
			log.Warningf("Skipping %v, self-referential root", m.String())
			continue
		}

		rootService := string(sourceSvc)
		rootVersion := string(sourceVer)
		md := make(map[string]interface{})
		md["link_prom_graph"] = linkPromGraph(client.Address(), o.metric, rootService, rootVersion)

		root := tree.NewServiceNode(rootService, rootVersion)
		root.Parent = nil
		root.Metadata = md

		seenNodes[root.ID] = &root

		log.Debugf("Building service tree for Root ServiceNode: %v\n", root.ID)
		buildServiceSubtree(&root, o.service, queryTime, seenNodes, o, client)
		trees = append(trees, root)
	}

	return trees
}

func buildServiceSubtree(sn *tree.ServiceNode, destinationSvc string, start time.Time, seenNodes map[string]*tree.ServiceNode, o options, client *prometheus.Client) {
	log.Debugf("Adding children for ServiceNode: %v\n", sn.ID)

	var destinationSvcFilter string
	if "" == destinationSvc {
		destinationSvcFilter = fmt.Sprintf(".*\\\\.%v\\\\..*", o.namespace)
	} else {
		destinationSvcFilter = fmt.Sprintf("%v\\\\.%v\\\\..*", o.service, o.namespace)
	}
	query := fmt.Sprintf("sum(rate(%v{source_service=\"%v\",source_version=\"%v\",destination_service=~\"%v\",response_code=~\"%v\"} [%vs]) * 60) by (%v)",
		o.metric,
		sn.Name,
		sn.Version,
		destinationSvcFilter,                                    // regex for destination service
		"[2345][0-9][0-9]",                                      // regex for valid response_codes
		o.interval.Seconds(),                                    // rate over the entire query period
		"destination_service,destination_version,response_code") // group by

	// fetch the root time series
	vector := promQuery(query, start, client.API())

	// identify the unique destination services
	destinations := toDestinations(sn.Name, sn.Version, vector)

	if len(destinations) > 0 {
		sn.Children = make([]*tree.ServiceNode, len(destinations))
		i := 0
		for k, d := range destinations {
			s := strings.Split(k, " ")
			d["link_prom_graph"] = linkPromGraph(client.Address(), o.metric, s[0], s[1])
			child := tree.NewServiceNode(s[0], s[1])
			child.Parent = sn
			child.Metadata = d

			log.Debugf("Child Service: %v(%v)->%v(%v)\n", sn.Name, sn.Version, child.Name, child.Version)
			sn.Children[i] = &child
			i++
		}
		// sort children for better presentation (and predictable testing)
		sort.Slice(sn.Children, func(i, j int) bool {
			return sn.Children[i].ID < sn.Children[j].ID
		})
		for _, child := range sn.Children {
			if _, seen := seenNodes[child.ID]; !seen {
				seenNodes[child.ID] = child
				if "" != destinationSvc {
					buildServiceSubtree(child, "", start, seenNodes, o, client)
				}
			} else {
				log.Debugf("Not recursing on seen child service: %v(%v)\n", child.Name, child.Version)
			}
		}
	}
}

func parseRequest(r *http.Request) options {
	// path variables
	vars := mux.Vars(r)
	namespace := vars["namespace"]
	service := vars["service"]

	// query params
	params := r.URL.Query()
	groupByVersion, groupByVersionErr := strconv.ParseBool(params.Get("groupByVersion"))
	interval, intervalErr := time.ParseDuration(params.Get("interval"))
	metric := params.Get("metric")
	offset, offsetErr := time.ParseDuration(params.Get("offset"))
	vendor := params.Get("vendor")

	if groupByVersionErr != nil {
		groupByVersion = true
	}
	if intervalErr != nil {
		interval, _ = time.ParseDuration("10m")
	}
	if "" == metric {
		metric = "istio_request_count"
	}
	if offsetErr != nil {
		offset, _ = time.ParseDuration("0m")
	}
	if "" == vendor {
		vendor = "cytoscape"
	}

	return options{
		namespace:      namespace,
		service:        service,
		vendor:         vendor,
		groupByVersion: groupByVersion,
		interval:       interval,
		metric:         metric,
		offset:         offset,
	}
}

func generateGraph(trees *[]tree.ServiceNode, w http.ResponseWriter, o options) {
	log.Debugf("Generating config for [%v] service graph...", o.vendor)

	var vendorConfig interface{}
	switch o.vendor {
	case "vizceral":
		vendorConfig = vizceral.NewConfig(o.namespace, trees)
	case "cytoscape":
		vendorConfig = cytoscape.NewConfig(o.namespace, trees, o.groupByVersion)
	}

	log.Debugf("Done generating config for [%v] service graph.", o.vendor)
	RespondWithJSONIndent(w, http.StatusOK, vendorConfig)
}

type Destination map[string]interface{}

// toDestinations takes a slice of [istio] series and returns a map K => D
// key = "destSvc destVersion"
// val = Destination (map) with the following keys
//          source_svc      string
//          source_ver      string
//          req_per_min     float64
//          req_per_min_2xx float64
//          req_per_min_3xx float64
//          req_per_min_4xx float64
//          req_per_min_5xx float64
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
				dest["req_per_min"] = 0.0
				dest["req_per_min_2xx"] = 0.0
				dest["req_per_min_3xx"] = 0.0
				dest["req_per_min_4xx"] = 0.0
				dest["req_per_min_5xx"] = 0.0
			}
			val := float64(s.Value)
			var ck string
			switch {
			case strings.HasPrefix(string(code), "2"):
				ck = "req_per_min_2xx"
			case strings.HasPrefix(string(code), "3"):
				ck = "req_per_min_3xx"
			case strings.HasPrefix(string(code), "4"):
				ck = "req_per_min_4xx"
			case strings.HasPrefix(string(code), "5"):
				ck = "req_per_min_5xx"
			}
			dest[ck] = dest[ck].(float64) + val
			dest["req_per_min"] = dest["req_per_min"].(float64) + val

			destinations[k] = dest
		}
	}
	return destinations
}

func linkPromGraph(server, ts, name, version string) (link string) {
	var promExpr string
	if tree.UnknownVersion == version {
		promExpr = fmt.Sprintf("%v{source_service=\"%v\",source_version=\"%v\"}", ts, name, version)
	} else {
		promExpr = fmt.Sprintf("%v{destination_service=\"%v\",destination_version=\"%v\"}", ts, name, version)
	}
	link = fmt.Sprintf("%v/graph?g0.range_input=1h&g0.tab=0&g0.expr=%v", server, url.QueryEscape(promExpr))
	return link
}

// TF is the TimeFormat for printing timestamp
const TF = "2006-01-02 15:04:05"

func promQuery(query string, queryTime time.Time, api v1.API) model.Vector {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

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
		log.Errorf("Error: %v\n", message)
		RespondWithError(w, http.StatusInternalServerError, message)
	}
}
