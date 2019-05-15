package graph

import (
	"fmt"
	"strings"

	"github.com/kiali/kiali/log"
)

const (
	requestsPerSecond = "requests per second"
	rps               = "rps"
)

type Rate struct {
	Name         string
	IsErr        bool
	IsIn         bool
	IsOut        bool
	IsPercentErr bool
	IsPercentReq bool
	IsTotal      bool
	Precision    int
}

type Protocol struct {
	Name          string
	EdgeRates     []Rate
	EdgeResponses string
	NodeRates     []Rate
	Unit          string
	UnitShort     string
}

const (
	grpc           = "grpc"
	grpcErr        = "grpcErr"
	grpcPercentErr = "grpcPercentErr"
	grpcPercentReq = "grpcPercentReq"
	grpcResponses  = "grpcResponses"
	grpcIn         = "grpcIn"
	grpcInErr      = "grpcInErr"
	grpcOut        = "grpcOut"
)

var GRPC Protocol = Protocol{
	Name: grpc,
	EdgeRates: []Rate{
		Rate{Name: grpc, IsTotal: true, Precision: 2},
		Rate{Name: grpcErr, IsErr: true, Precision: 2},
		Rate{Name: grpcPercentErr, IsPercentErr: true, Precision: 1},
		Rate{Name: grpcPercentReq, IsPercentReq: true, Precision: 1},
	},
	EdgeResponses: grpcResponses,
	NodeRates: []Rate{
		Rate{Name: grpcIn, IsIn: true, Precision: 2},
		Rate{Name: grpcInErr, IsErr: true, Precision: 2},
		Rate{Name: grpcOut, IsOut: true, Precision: 2},
	},
	Unit:      requestsPerSecond,
	UnitShort: rps,
}

const (
	http           = "http"
	http3xx        = "http3xx"
	http4xx        = "http4xx"
	http5xx        = "http5xx"
	httpPercentErr = "httpPercentErr"
	httpPercentReq = "httpPercentReq"
	httpResponses  = "httpResponses"
	httpIn         = "httpIn"
	httpIn3xx      = "httpIn3xx"
	httpIn4xx      = "httpIn4xx"
	httpIn5xx      = "httpIn5xx"
	httpOut        = "httpOut"
)

var HTTP Protocol = Protocol{
	Name: http,
	EdgeRates: []Rate{
		Rate{Name: http, IsTotal: true, Precision: 2},
		Rate{Name: http3xx, Precision: 2},
		Rate{Name: http4xx, IsErr: true, Precision: 2},
		Rate{Name: http5xx, IsErr: true, Precision: 2},
		Rate{Name: httpPercentErr, IsPercentErr: true, Precision: 1},
		Rate{Name: httpPercentReq, IsPercentReq: true, Precision: 1},
	},
	EdgeResponses: httpResponses,
	NodeRates: []Rate{
		Rate{Name: httpIn, IsIn: true, Precision: 2},
		Rate{Name: httpIn3xx, Precision: 2},
		Rate{Name: httpIn4xx, IsErr: true, Precision: 2},
		Rate{Name: httpIn5xx, IsErr: true, Precision: 2},
		Rate{Name: httpOut, IsOut: true, Precision: 2},
	},
	Unit:      requestsPerSecond,
	UnitShort: rps,
}

const (
	tcp            = "tcp"
	tcpResponses   = "tcpResponses"
	tcpIn          = "tcpIn"
	tcpOut         = "tcpOut"
	bytesPerSecond = "bytes per second"
	bps            = "bps"
)

var TCP Protocol = Protocol{
	Name: tcp,
	EdgeRates: []Rate{
		Rate{Name: tcp, IsTotal: true, Precision: 2},
	},
	EdgeResponses: tcpResponses,
	NodeRates: []Rate{
		Rate{Name: tcpIn, IsIn: true, Precision: 2},
		Rate{Name: tcpOut, IsOut: true, Precision: 2},
	},
	Unit:      bytesPerSecond,
	UnitShort: bps,
}

var Protocols []Protocol = []Protocol{GRPC, HTTP, TCP}

func AddToMetadata(protocol string, val float64, code, flags string, sourceMetadata, destMetadata, edgeMetadata map[string]interface{}) {
	if val <= 0.0 {
		return
	}

	switch protocol {
	case grpc:
		addToMetadataGrpc(val, code, flags, sourceMetadata, destMetadata, edgeMetadata)
	case http:
		addToMetadataHttp(val, code, flags, sourceMetadata, destMetadata, edgeMetadata)
	case tcp:
		addToMetadataTcp(val, flags, sourceMetadata, destMetadata, edgeMetadata)
	default:
		log.Tracef("Ignore unhandled metadata protocol [%s]", protocol)
	}
}

func addToMetadataGrpc(val float64, code, flags string, sourceMetadata, destMetadata, edgeMetadata map[string]interface{}) {
	addToMetadataValue(sourceMetadata, grpcOut, val)
	addToMetadataValue(destMetadata, grpcIn, val)
	addToMetadataValue(edgeMetadata, grpc, val)
	addToMetadataResponses(edgeMetadata, grpcResponses, code, flags, val)

	// Istio telemetry may use HTTP codes for gRPC, so if it quacks like a duck...
	isHttpCode := len(code) == 3
	isErr := false
	if isHttpCode {
		isErr = strings.HasPrefix(code, "4") || strings.HasPrefix(code, "5")
	} else {
		isErr = code != "0"
	}
	if isErr {
		addToMetadataValue(destMetadata, grpcInErr, val)
		addToMetadataValue(edgeMetadata, grpcErr, val)
	}
}

func addToMetadataHttp(val float64, code, flags string, sourceMetadata, destMetadata, edgeMetadata map[string]interface{}) {
	addToMetadataValue(sourceMetadata, httpOut, val)
	addToMetadataValue(destMetadata, httpIn, val)
	addToMetadataValue(edgeMetadata, http, val)
	addToMetadataResponses(edgeMetadata, httpResponses, code, flags, val)

	// note, we don't track 2xx because it's not used downstream and can be easily
	// calculated: 2xx = (rate - 3xx - 4xx - 5xx)
	switch {
	case strings.HasPrefix(code, "3"):
		addToMetadataValue(destMetadata, httpIn3xx, val)
		addToMetadataValue(edgeMetadata, http3xx, val)
	case strings.HasPrefix(code, "4"):
		addToMetadataValue(destMetadata, httpIn4xx, val)
		addToMetadataValue(edgeMetadata, http4xx, val)
	case strings.HasPrefix(code, "5"):
		addToMetadataValue(destMetadata, httpIn5xx, val)
		addToMetadataValue(edgeMetadata, http5xx, val)
	}
}

func addToMetadataTcp(val float64, flags string, sourceMetadata, destMetadata, edgeMetadata map[string]interface{}) {
	addToMetadataValue(sourceMetadata, tcpOut, val)
	addToMetadataValue(destMetadata, tcpIn, val)
	addToMetadataValue(edgeMetadata, tcp, val)
	addToMetadataResponses(edgeMetadata, tcpResponses, "-", flags, val)
}

func AddOutgoingEdgeToMetadata(sourceMetadata, edgeMetadata map[string]interface{}) {
	if val, valOk := edgeMetadata[grpc]; valOk {
		addToMetadataValue(sourceMetadata, grpcOut, val.(float64))
	}
	if val, valOk := edgeMetadata[http]; valOk {
		addToMetadataValue(sourceMetadata, httpOut, val.(float64))
	}
	if val, valOk := edgeMetadata[tcp]; valOk {
		addToMetadataValue(sourceMetadata, tcpOut, val.(float64))
	}
}

func AddServiceGraphTraffic(toEdge, fromEdge *Edge) {
	protocol, ok := toEdge.Metadata["protocol"]
	if !ok {
		return
	}

	switch protocol {
	case grpc:
		if val, ok := fromEdge.Metadata[grpc]; ok {
			addToMetadataValue(toEdge.Metadata, grpc, val.(float64))
		}
		if val, ok := fromEdge.Metadata[grpcErr]; ok {
			addToMetadataValue(toEdge.Metadata, grpcErr, val.(float64))
		}
		if responses, ok := fromEdge.Metadata[grpcResponses]; ok {
			addToResponses(toEdge.Metadata, grpcResponses, responses.(Responses))
		}
	case http:
		if val, ok := fromEdge.Metadata[http]; ok {
			addToMetadataValue(toEdge.Metadata, http, val.(float64))
		}
		if val, ok := fromEdge.Metadata[http3xx]; ok {
			addToMetadataValue(toEdge.Metadata, http3xx, val.(float64))
		}
		if val, ok := fromEdge.Metadata[http4xx]; ok {
			addToMetadataValue(toEdge.Metadata, http4xx, val.(float64))
		}
		if val, ok := fromEdge.Metadata[http5xx]; ok {
			addToMetadataValue(toEdge.Metadata, http5xx, val.(float64))
		}
		if responses, ok := fromEdge.Metadata[httpResponses]; ok {
			addToResponses(toEdge.Metadata, httpResponses, responses.(Responses))
		}
	case tcp:
		if val, ok := fromEdge.Metadata[tcp]; ok {
			addToMetadataValue(toEdge.Metadata, grpc, val.(float64))
		}
		if responses, ok := fromEdge.Metadata[tcpResponses]; ok {
			addToResponses(toEdge.Metadata, tcpResponses, responses.(Responses))
		}

	default:
		Error(fmt.Sprintf("Unexpected edge protocol [%v] for edge [%+v]", protocol, toEdge))
	}

	// handle any appender-based edge data (nothing currently)
	// note: We used to average response times of the aggregated edges but realized that
	// we can't average quantiles (kiali-2297).
}

func addToMetadataValue(md map[string]interface{}, k string, v float64) {
	if v <= 0 {
		return
	}
	if curr, ok := md[k]; ok {
		md[k] = curr.(float64) + v
	} else {
		md[k] = v
	}
}

// The metadata for response codes is a map of maps. Each response code is broken down by responseFlags:percentageOfTraffic like this:
// "200" : {
//   "-"  : 90.00,
//   "DC" : 10.00,
// }, ...

type ResponseFlags map[string]float64
type Responses map[string]ResponseFlags

func addToResponses(md map[string]interface{}, k string, responses Responses) {
	for code, flagsValMap := range responses {
		for flags, val := range flagsValMap {
			addToMetadataResponses(md, k, code, flags, val)
		}
	}
}

func addToMetadataResponses(md map[string]interface{}, k, code, flags string, v float64) {
	if responses, ok := md[k]; ok {
		if flagsValueMap, ok2 := responses.(Responses)[code]; ok2 {
			flagsValueMap[flags] += v
		} else {
			responses.(Responses)[code] = ResponseFlags{flags: v}
		}
	} else {
		md[k] = Responses{code: {flags: v}}
	}
}

// averageMetadataValue is currently unused but shows how to perform averaging using metadata values.
//func averageMetadataValue(md map[string]interface{}, k string, v float64) {
//	total := v
//	count := 1.0
//	kTotal := k + "_total"
//	kCount := k + "_count"
//	if prevTotal, ok := md[kTotal]; ok {
//		total += prevTotal.(float64)
//	}
//	if prevCount, ok := md[kCount]; ok {
//		count += prevCount.(float64)
//	}
//	md[kTotal] = total
//	md[kCount] = count
//	md[k] = total / count
//}
