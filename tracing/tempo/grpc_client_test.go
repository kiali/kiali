package tempo

import (
	"context"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/test/bufconn"

	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/tracing/tempo/tempopb"
)

func getgRPCBaseUrl() *url.URL {
	baseUrl, _ := url.Parse(tracingUrl)
	return baseUrl
}

type mockgRPCServer struct {
	streamingClient tempopb.UnimplementedStreamingQuerierServer
}

func (s *mockgRPCServer) Search(req *tempopb.SearchRequest, srv tempopb.StreamingQuerier_SearchServer) error {
	return s.streamingClient.Search(req, srv)
}

func dialer() func(context.Context, string) (net.Conn, error) {
	listener := bufconn.Listen(1024 * 1024)

	server := grpc.NewServer()

	tempopb.RegisterStreamingQuerierServer(server, &mockgRPCServer{})

	go func() {
		if err := server.Serve(listener); err != nil {
			log.Fatal(err)
		}
	}()

	return func(context.Context, string) (net.Conn, error) {
		return listener.Dial()
	}
}

func TestCreateGRPCClient(t *testing.T) {

	resp, err := os.Open(responseFile)
	assert.Nil(t, err)
	defer resp.Close()

	byteValue, _ := io.ReadAll(resp)

	httpClient := http.Client{Transport: RoundTripFunc(func(req *http.Request) *http.Response {
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(strings.NewReader(string(byteValue))),
		}
	})}

	ctx := context.Background()
	clientConn, err := grpc.DialContext(ctx, "", grpc.WithTransportCredentials(insecure.NewCredentials()), grpc.WithContextDialer(dialer()))
	assert.Nil(t, err)
	assert.NotNil(t, clientConn)

	streamClient, err := NewgRPCClient(httpClient, getgRPCBaseUrl(), clientConn)

	assert.Nil(t, err)
	assert.NotNil(t, streamClient)
}
