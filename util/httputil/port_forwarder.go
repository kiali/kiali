package httputil

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/portforward"
	"k8s.io/client-go/transport/spdy"

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
}

// deadlineRoundTripper bounds a single round trip's time to its response headers. Used for
// the SPDY upgrade request: canceling the context aborts a handshake that never completes,
// while a completed (hijacked) connection is unaffected.
type deadlineRoundTripper struct {
	delegate http.RoundTripper
	timeout  time.Duration
}

func (d *deadlineRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	ctx, cancel := context.WithTimeout(req.Context(), d.timeout)
	defer cancel()
	return d.delegate.RoundTrip(req.WithContext(ctx))
}

// portForwardEstablishTimeout bounds how long establishing a port-forward (SPDY dial +
// upgrade handshake) may take. The SPDY round tripper is built from TLS and proxy settings
// only - it never sees the rest config's dialer or request timeout - and ForwardPorts waits
// for readiness with no cancellation, so without this bound a stalled peer hangs the
// operation indefinitely. The bound is applied twice: a response-header deadline on the
// SPDY transport (which cancels the upgrade handshake at the HTTP layer, closing the
// connection even though ForwardPorts itself only observes the stop channel after the dial
// returns) and a timer in Start as the last resort. An established tunnel is not bounded by
// this; the hijacked connection outlives the header deadline, and the tunnel lives until
// Stop.
const portForwardEstablishTimeout = 10 * time.Second

func (f forwarder) Start() error {
	// It starts the port-forward
	errCh := make(chan error, 1)
	go func() {
		// TODO: Need a mechanism to catch errors and retry pod forwarding
		// with a different pod if the connection to the current pod gets closed.
		errCh <- f.forwarder.ForwardPorts()
	}()

	// Waiting until the ReadyChan has a value, bounded: an unresponsive peer must not hang
	// the caller (envoy/ztunnel dumps) forever.
	timeout := time.NewTimer(portForwardEstablishTimeout)
	defer timeout.Stop()
	select {
	case err := <-errCh:
		log.Error("Failing starting the port forwarding")
		return err
	case <-f.ReadyCh:
		// Ready to forward requests
		return nil
	case <-timeout.C:
		// Stop the background ForwardPorts attempt; its error (if any) is dropped.
		close(f.StopCh)
		return fmt.Errorf("timed out after %s waiting for the port-forward to become ready", portForwardEstablishTimeout)
	}
}

func (f forwarder) Stop() {
	// Closing the StopCh channel is closing the forwarding
	close(f.StopCh)
	Pool.FreePort(f.localPort)
}

func NewPortForwarder(client rest.Interface, clientConfig *rest.Config, namespace, pod, address, portMap string, writer io.Writer) (PortForwarder, error) {
	stopCh := make(chan struct{})
	readyCh := make(chan struct{})

	forwarderUrl := client.Post().
		Namespace(namespace).
		Resource("pods").
		Name(pod).
		SubResource("portforward").URL()

	transport, upgrader, err := spdy.RoundTripperFor(clientConfig)
	if err != nil {
		log.Errorf("Error creating a RoundTripper: %v", err)
		return nil, err
	}

	// Bound the upgrade handshake: without it a peer that accepts the connection but never
	// answers the upgrade leaves the dial (and thus ForwardPorts) hanging past every outer
	// bound, because the stop channel is only observed after the dial returns. The bound is
	// a wrapping round tripper rather than a ResponseHeaderTimeout on the transport:
	// RoundTripperFor may return a wrapper (an auth transport, or the SPDY round tripper
	// itself) rather than a bare *http.Transport. Canceling the request context aborts the
	// in-flight handshake; once the upgrade succeeds the connection is hijacked and no
	// longer tied to the context, so established tunnels are unaffected.
	dialer := spdy.NewDialer(upgrader, &http.Client{Transport: &deadlineRoundTripper{
		delegate: transport,
		timeout:  portForwardEstablishTimeout,
	}}, http.MethodPost, forwarderUrl)
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
		forwarder: fwer,
		ReadyCh:   readyCh,
		StopCh:    stopCh,
		localPort: localPort,
	}

	return &f, nil
}
