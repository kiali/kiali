package tempo

import (
	"context"
	"net"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/test/bufconn"

	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/tracing/tempo/tempopb"
)

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

	clientConn, err := grpc.NewClient("", grpc.WithTransportCredentials(insecure.NewCredentials()), grpc.WithContextDialer(dialer()))
	assert.Nil(t, err)
	assert.NotNil(t, clientConn)

	streamClient, err := NewgRPCClient(clientConn)

	assert.Nil(t, err)
	assert.NotNil(t, streamClient)
}
