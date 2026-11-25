package httputil

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptrace"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	// client-go's portforward still consumes the apimachinery httpstream types.
	"k8s.io/apimachinery/pkg/util/httpstream"      //nolint:staticcheck // SA1019
	"k8s.io/apimachinery/pkg/util/httpstream/spdy" //nolint:staticcheck // SA1019
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/portforward"

	"github.com/kiali/kiali/log"
)

type PortForwarder interface {
	Start() error
	Stop()
}

type forwarder struct {
	forwarder *portforward.PortForwarder
	ReadyCh   chan struct{}
	StopCh    chan struct{}
	localPort int
	// establishTimeout bounds the ready-wait; see NewPortForwarder.
	establishTimeout time.Duration
}

// Use net/http for the HTTP/1 upgrade so cancellation interrupts the underlying
// socket even while waiting for proxy or API server response headers.
type portForwardDialer struct {
	client  *http.Client
	timeout time.Duration
	url     *url.URL
}

type upgradedConn struct {
	net.Conn
	body   io.ReadWriteCloser
	cancel context.CancelFunc
}

// Read through the upgrade body to preserve any frames buffered with the headers.
func (c *upgradedConn) Read(p []byte) (int, error)  { return c.body.Read(p) }
func (c *upgradedConn) Write(p []byte) (int, error) { return c.body.Write(p) }
func (c *upgradedConn) Close() error {
	defer c.cancel()
	return c.body.Close()
}

func (d *portForwardDialer) Dial(protocols ...string) (httpstream.Connection, string, error) {
	ctx, cancel := context.WithCancel(context.Background())
	// A zero or negative timeout disables the bound (waits forever) - the same
	// interpretation Start() gives the setting. time.AfterFunc(0) would fire
	// immediately and cancel every upgrade.
	var timer *time.Timer
	if d.timeout > 0 {
		timer = time.AfterFunc(d.timeout, cancel)
	}
	stopTimer := func() {
		if timer != nil {
			timer.Stop()
		}
	}
	var socket net.Conn
	trace := &httptrace.ClientTrace{GotConn: func(info httptrace.GotConnInfo) { socket = info.Conn }}
	req, err := http.NewRequestWithContext(httptrace.WithClientTrace(ctx, trace), http.MethodPost, d.url.String(), nil)
	if err != nil {
		stopTimer()
		cancel()
		return nil, "", err
	}
	req.Header.Set(httpstream.HeaderConnection, httpstream.HeaderUpgrade)
	req.Header.Set(httpstream.HeaderUpgrade, spdy.HeaderSpdy31)
	req.Header[httpstream.HeaderProtocolVersion] = protocols
	resp, err := d.client.Do(req)
	if err != nil {
		stopTimer()
		cancel()
		return nil, "", err
	}
	stream, ok := resp.Body.(io.ReadWriteCloser)
	if !ok || socket == nil || resp.StatusCode != http.StatusSwitchingProtocols || !strings.EqualFold(resp.Header.Get(httpstream.HeaderUpgrade), spdy.HeaderSpdy31) {
		defer resp.Body.Close()
		defer cancel()
		defer stopTimer()
		detail, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, "", fmt.Errorf("port-forward upgrade failed (%s): %s", resp.Status, detail)
	}
	if timer != nil && !timer.Stop() {
		cancel()
		stream.Close()
		return nil, "", context.DeadlineExceeded
	}
	upgraded := &upgradedConn{Conn: socket, body: stream, cancel: cancel}
	// The 5s ping interval is an SPDY protocol keepalive, not a latency budget: it only
	// keeps an established forwarded connection from being idled out by intermediaries,
	// so it stays hardcoded - no environment needs a different value.
	conn, err := spdy.NewClientConnectionWithPings(upgraded, 5*time.Second)
	if err != nil {
		upgraded.Close()
		return nil, "", err
	}
	return conn, resp.Header.Get(httpstream.HeaderProtocolVersion), nil
}

func (f forwarder) Start() error {
	// It starts the port-forward
	errCh := make(chan error, 1)
	go func() {
		// TODO: Need a mechanism to catch errors and retry pod forwarding
		// with a different pod if the connection to the current pod gets closed.
		errCh <- f.forwarder.ForwardPorts()
	}()

	// Waiting until the ReadyChan has a value, bounded: an unresponsive peer must not hang
	// the caller (envoy/ztunnel dumps) forever. A zero or negative bound waits forever.
	var timeoutCh <-chan time.Time
	if f.establishTimeout > 0 {
		timer := time.NewTimer(f.establishTimeout)
		defer timer.Stop()
		timeoutCh = timer.C
	}
	select {
	case err := <-errCh:
		log.Error("Failing starting the port forwarding")
		return err
	case <-f.ReadyCh:
		// Ready to forward requests
		return nil
	case <-timeoutCh:
		// Stop the background ForwardPorts attempt; its error (if any) is dropped.
		close(f.StopCh)
		return fmt.Errorf("timed out after %s waiting for the port-forward to become ready", f.establishTimeout)
	}
}

func (f forwarder) Stop() {
	// Closing the StopCh channel is closing the forwarding
	close(f.StopCh)
	Pool.FreePort(f.localPort)
}

// establishTimeout bounds the SPDY upgrade and handshake (kiali_internal.
// kubernetes_client.port_forward_establish_timeout; <= 0 disables the bound).
func NewPortForwarder(client rest.Interface, clientConfig *rest.Config, namespace, pod, address, portMap string, writer io.Writer, establishTimeout time.Duration) (PortForwarder, error) {
	stopCh := make(chan struct{})
	readyCh := make(chan struct{})

	forwarderUrl := client.Post().
		Namespace(namespace).
		Resource("pods").
		Name(pod).
		SubResource("portforward").URL()

	cfg := rest.CopyConfig(clientConfig)
	cfg.NextProtos = []string{"http/1.1"}
	transport, err := rest.TransportFor(cfg)
	if err != nil {
		return nil, err
	}
	dialer := &portForwardDialer{client: &http.Client{Transport: transport, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}, timeout: establishTimeout, url: forwarderUrl}
	fwer, err := portforward.NewOnAddresses(dialer, []string{address}, []string{portMap},
		stopCh, readyCh, writer, os.Stderr)
	if err != nil {
		log.Errorf("Error creating the port-forwarder: %v", err)
		return nil, err
	}

	localPort, err := strconv.Atoi(strings.Split(portMap, ":")[0])
	if err != nil {
		log.Errorf("wrong port mapping between local port and destination port: %v", err)
		return nil, err
	}

	f := forwarder{
		forwarder:        fwer,
		ReadyCh:          readyCh,
		StopCh:           stopCh,
		establishTimeout: establishTimeout,
		localPort:        localPort,
	}

	return &f, nil
}
