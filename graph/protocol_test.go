package graph

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// TestAggregateEdgeTraffic_GRPC ensures every GRPC edge rate and responses are aggregated.
// If a new rate is added to GRPC.EdgeRates or aggregation is omitted, this test fails.
func TestAggregateEdgeTraffic_GRPC(t *testing.T) {
	src := &Node{ID: "src", Metadata: NewMetadata()}
	dest := &Node{ID: "dest", Metadata: NewMetadata()}

	agg := NewEdge(src, dest)
	agg.Metadata[ProtocolKey] = grpc
	agg.Metadata[grpc] = 10.0
	agg.Metadata[grpcNoResponse] = 1.0
	agg.Metadata[grpcErr] = 2.0
	agg.Metadata[grpcResponses] = Responses{
		"-": {Flags: ResponseFlags{"DC": 50.0}, Hosts: ResponseHosts{}},
	}

	e2 := NewEdge(src, dest)
	e2.Metadata[ProtocolKey] = grpc
	e2.Metadata[grpc] = 20.0
	e2.Metadata[grpcNoResponse] = 3.0
	e2.Metadata[grpcErr] = 4.0
	e2.Metadata[grpcResponses] = Responses{
		"-": {Flags: ResponseFlags{"DC": 25.0}, Hosts: ResponseHosts{}},
	}

	AggregateEdgeTraffic(&e2, &agg)

	assert.Equal(t, 30.0, agg.Metadata[grpc].(float64), "grpc total")
	assert.Equal(t, 4.0, agg.Metadata[grpcNoResponse].(float64), "grpcNoResponse")
	assert.Equal(t, 6.0, agg.Metadata[grpcErr].(float64), "grpcErr")
	resp := agg.Metadata[grpcResponses].(Responses)
	assert.Contains(t, resp, "-")
	assert.Equal(t, 75.0, resp["-"].Flags["DC"], "grpcResponses merged")
}

// TestAggregateEdgeTraffic_HTTP ensures every HTTP edge rate and responses are aggregated.
func TestAggregateEdgeTraffic_HTTP(t *testing.T) {
	src := &Node{ID: "src", Metadata: NewMetadata()}
	dest := &Node{ID: "dest", Metadata: NewMetadata()}

	agg := NewEdge(src, dest)
	agg.Metadata[ProtocolKey] = http
	agg.Metadata[http] = 100.0
	agg.Metadata[httpNoResponse] = 10.0
	agg.Metadata[http3xx] = 20.0
	agg.Metadata[http4xx] = 5.0
	agg.Metadata[http5xx] = 2.0
	agg.Metadata[httpResponses] = Responses{
		"200": {Flags: ResponseFlags{"-": 60.0}, Hosts: ResponseHosts{}},
	}

	e2 := NewEdge(src, dest)
	e2.Metadata[ProtocolKey] = http
	e2.Metadata[http] = 50.0
	e2.Metadata[httpNoResponse] = 5.0
	e2.Metadata[http3xx] = 10.0
	e2.Metadata[http4xx] = 3.0
	e2.Metadata[http5xx] = 1.0
	e2.Metadata[httpResponses] = Responses{
		"200": {Flags: ResponseFlags{"-": 30.0}, Hosts: ResponseHosts{}},
	}

	AggregateEdgeTraffic(&e2, &agg)

	assert.Equal(t, 150.0, agg.Metadata[http].(float64), "http total")
	assert.Equal(t, 15.0, agg.Metadata[httpNoResponse].(float64), "httpNoResponse")
	assert.Equal(t, 30.0, agg.Metadata[http3xx].(float64), "http3xx")
	assert.Equal(t, 8.0, agg.Metadata[http4xx].(float64), "http4xx")
	assert.Equal(t, 3.0, agg.Metadata[http5xx].(float64), "http5xx")
	resp := agg.Metadata[httpResponses].(Responses)
	assert.Equal(t, 90.0, resp["200"].Flags["-"], "httpResponses merged")
}

// TestAggregateEdgeTraffic_TCP ensures TCP edge total and responses are aggregated.
func TestAggregateEdgeTraffic_TCP(t *testing.T) {
	src := &Node{ID: "src", Metadata: NewMetadata()}
	dest := &Node{ID: "dest", Metadata: NewMetadata()}

	agg := NewEdge(src, dest)
	agg.Metadata[ProtocolKey] = tcp
	agg.Metadata[tcp] = 1000.0
	agg.Metadata[tcpResponses] = Responses{
		"-": {Flags: ResponseFlags{"-": 1000.0}, Hosts: ResponseHosts{}},
	}

	e2 := NewEdge(src, dest)
	e2.Metadata[ProtocolKey] = tcp
	e2.Metadata[tcp] = 500.0
	e2.Metadata[tcpResponses] = Responses{
		"-": {Flags: ResponseFlags{"-": 500.0}, Hosts: ResponseHosts{}},
	}

	AggregateEdgeTraffic(&e2, &agg)

	assert.Equal(t, 1500.0, agg.Metadata[tcp].(float64), "tcp total")
	resp := agg.Metadata[tcpResponses].(Responses)
	assert.Equal(t, 1500.0, resp["-"].Flags["-"], "tcpResponses merged")
}

// TestAggregateNodeTraffic sums all protocol node rates from two nodes.
func TestAggregateNodeTraffic(t *testing.T) {
	n1 := &Node{ID: "n1", Metadata: NewMetadata()}
	n1.Metadata[grpcIn] = 10.0
	n1.Metadata[grpcInNoResponse] = 1.0
	n1.Metadata[grpcInErr] = 2.0
	n1.Metadata[grpcOut] = 15.0
	n1.Metadata[httpIn] = 100.0
	n1.Metadata[httpInNoResponse] = 5.0
	n1.Metadata[httpIn3xx] = 10.0
	n1.Metadata[httpIn4xx] = 3.0
	n1.Metadata[httpIn5xx] = 2.0
	n1.Metadata[httpOut] = 80.0
	n1.Metadata[tcpIn] = 50.0
	n1.Metadata[tcpOut] = 60.0

	n2 := &Node{ID: "n2", Metadata: NewMetadata()}
	n2.Metadata[grpcIn] = 20.0
	n2.Metadata[grpcInNoResponse] = 3.0
	n2.Metadata[grpcInErr] = 4.0
	n2.Metadata[grpcOut] = 25.0
	n2.Metadata[httpIn] = 200.0
	n2.Metadata[httpInNoResponse] = 10.0
	n2.Metadata[httpIn3xx] = 20.0
	n2.Metadata[httpIn4xx] = 6.0
	n2.Metadata[httpIn5xx] = 4.0
	n2.Metadata[httpOut] = 120.0
	n2.Metadata[tcpIn] = 100.0
	n2.Metadata[tcpOut] = 90.0

	agg := &Node{ID: "agg", Metadata: NewMetadata()}
	AggregateNodeTraffic(n1, agg)
	AggregateNodeTraffic(n2, agg)

	assert.Equal(t, 30.0, agg.Metadata[grpcIn].(float64))
	assert.Equal(t, 4.0, agg.Metadata[grpcInNoResponse].(float64))
	assert.Equal(t, 6.0, agg.Metadata[grpcInErr].(float64))
	assert.Equal(t, 40.0, agg.Metadata[grpcOut].(float64))
	assert.Equal(t, 300.0, agg.Metadata[httpIn].(float64))
	assert.Equal(t, 15.0, agg.Metadata[httpInNoResponse].(float64))
	assert.Equal(t, 30.0, agg.Metadata[httpIn3xx].(float64))
	assert.Equal(t, 9.0, agg.Metadata[httpIn4xx].(float64))
	assert.Equal(t, 6.0, agg.Metadata[httpIn5xx].(float64))
	assert.Equal(t, 200.0, agg.Metadata[httpOut].(float64))
	assert.Equal(t, 150.0, agg.Metadata[tcpIn].(float64))
	assert.Equal(t, 150.0, agg.Metadata[tcpOut].(float64))
}

// TestAddToMetadata_NoResponse ensures code "-" populates NoResponse on edge and dest.
func TestAddToMetadata_NoResponse(t *testing.T) {
	srcMd := NewMetadata()
	destMd := NewMetadata()
	edgeMd := NewMetadata()

	AddToMetadata(grpc, 5.0, "-", "DC", "host", srcMd, destMd, edgeMd)
	assert.Equal(t, 5.0, edgeMd[grpcNoResponse].(float64), "grpc edge noResponse")
	assert.Equal(t, 5.0, destMd[grpcInNoResponse].(float64), "grpc dest inNoResponse")

	srcMd = NewMetadata()
	destMd = NewMetadata()
	edgeMd = NewMetadata()
	AddToMetadata(http, 10.0, "-", "DC", "", srcMd, destMd, edgeMd)
	assert.Equal(t, 10.0, edgeMd[httpNoResponse].(float64), "http edge noResponse")
	assert.Equal(t, 10.0, destMd[httpInNoResponse].(float64), "http dest inNoResponse")
}

// TestAddToMetadata_HTTPCodes ensures HTTP code paths set correct buckets.
func TestAddToMetadata_HTTPCodes(t *testing.T) {
	srcMd := NewMetadata()
	destMd := NewMetadata()
	edgeMd := NewMetadata()

	AddToMetadata(http, 1.0, "200", "-", "", srcMd, destMd, edgeMd)
	assert.Equal(t, 1.0, edgeMd[http].(float64))
	_, hasNoResp := edgeMd[httpNoResponse]
	assert.False(t, hasNoResp)

	AddToMetadata(http, 2.0, "404", "-", "", srcMd, destMd, edgeMd)
	assert.Equal(t, 2.0, edgeMd[http4xx].(float64))
	assert.Equal(t, 2.0, destMd[httpIn4xx].(float64))

	AddToMetadata(http, 3.0, "503", "-", "", srcMd, destMd, edgeMd)
	assert.Equal(t, 3.0, edgeMd[http5xx].(float64))
	assert.Equal(t, 3.0, destMd[httpIn5xx].(float64))
}

// TestIsHTTPErr and TestIsGRPCErr document and lock behavior.
func TestIsHTTPErr(t *testing.T) {
	assert.True(t, IsHTTPErr("404"))
	assert.True(t, IsHTTPErr("503"))
	assert.False(t, IsHTTPErr("200"))
	assert.False(t, IsHTTPErr("302"))
}

func TestIsGRPCErr(t *testing.T) {
	assert.True(t, IsGRPCErr("1"))
	assert.True(t, IsGRPCErr("14"))
	assert.False(t, IsGRPCErr("0"))
	assert.False(t, IsGRPCErr(""))
}

// TestAddOutgoingEdgeToMetadata copies edge totals to source node outgoing.
func TestAddOutgoingEdgeToMetadata(t *testing.T) {
	srcMd := NewMetadata()
	edgeMd := NewMetadata()
	edgeMd[grpc] = 10.0
	edgeMd[http] = 20.0
	edgeMd[tcp] = 30.0

	AddOutgoingEdgeToMetadata(srcMd, edgeMd)
	assert.Equal(t, 10.0, srcMd[grpcOut].(float64))
	assert.Equal(t, 20.0, srcMd[httpOut].(float64))
	assert.Equal(t, 30.0, srcMd[tcpOut].(float64))
}

// TestResetOutgoingMetadata clears outgoing rate keys.
func TestResetOutgoingMetadata(t *testing.T) {
	md := NewMetadata()
	md[grpcOut] = 1.0
	md[httpOut] = 2.0
	md[tcpOut] = 3.0

	ResetOutgoingMetadata(md)
	_, ok := md[grpcOut]
	assert.False(t, ok)
	_, ok = md[httpOut]
	assert.False(t, ok)
	_, ok = md[tcpOut]
	assert.False(t, ok)
}
