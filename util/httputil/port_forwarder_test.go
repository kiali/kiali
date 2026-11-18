package httputil

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	// client-go's portforward still consumes the apimachinery httpstream types.
	"k8s.io/apimachinery/pkg/util/httpstream"      //nolint:staticcheck // SA1019
	"k8s.io/apimachinery/pkg/util/httpstream/spdy" //nolint:staticcheck // SA1019
)

func TestPortForwardHandshakeDeadline(t *testing.T) {
	disconnected := make(chan struct{})
	release := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-r.Context().Done():
			close(disconnected)
		case <-release:
		}
	}))
	defer server.Close()
	defer close(release)
	endpoint, err := url.Parse(server.URL)
	require.NoError(t, err)
	dialer := portForwardDialer{client: server.Client(), timeout: 200 * time.Millisecond, url: endpoint}
	finished := make(chan error, 1)
	go func() { _, _, err := dialer.Dial("portforward.k8s.io"); finished <- err }()
	select {
	case err := <-finished:
		require.Error(t, err)
	case <-time.After(2 * time.Second):
		t.Fatal("SPDY dial did not exit after the handshake deadline")
	}
	select {
	case <-disconnected:
	case <-time.After(time.Second):
		t.Fatal("server still has a live upgrade request")
	}
}

func TestPortForwardStreamOutlivesHandshakeDeadline(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn := spdy.NewResponseUpgrader().UpgradeResponse(w, r, func(stream httpstream.Stream, replied <-chan struct{}) error {
			go func() { <-replied; defer stream.Close(); _, _ = io.Copy(stream, stream) }()
			return nil
		})
		if conn != nil {
			<-conn.CloseChan()
		}
	}))
	defer server.Close()
	endpoint, err := url.Parse(server.URL)
	require.NoError(t, err)
	dialer := portForwardDialer{client: server.Client(), timeout: 100 * time.Millisecond, url: endpoint}
	conn, _, err := dialer.Dial("portforward.k8s.io")
	require.NoError(t, err)
	defer conn.Close()
	time.Sleep(2 * dialer.timeout)
	stream, err := conn.CreateStream(http.Header{})
	require.NoError(t, err)
	defer stream.Close()
	_, err = io.WriteString(stream, "ping")
	require.NoError(t, err)
	buf := make([]byte, 4)
	_, err = io.ReadFull(stream, buf)
	require.NoError(t, err)
	require.Equal(t, "ping", string(buf))
}
