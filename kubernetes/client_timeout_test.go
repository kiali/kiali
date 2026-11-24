package kubernetes

import (
	"context"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/config"
)

func timeoutTestConfig(requestTimeout time.Duration) *config.Config {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "home"
	conf.KialiInternal.KubernetesClient.RequestTimeout = requestTimeout
	return conf
}

// TestNewClientFromConfigAppliesRequestTimeout covers the central #10545 mechanism: the
// configured request timeout lands on the client's own config copy, the incoming (shared)
// config is not mutated, and a preconfigured timeout is never loosened.
func TestNewClientFromConfigAppliesRequestTimeout(t *testing.T) {
	conf := timeoutTestConfig(10 * time.Second)

	incoming := &rest.Config{Host: "http://127.0.0.1:1"}
	client, err := NewClient(ClusterInfo{ClientConfig: incoming, Name: "remote"}, conf)
	if err != nil {
		t.Fatalf("NewClient failed: %v", err)
	}
	if client.restConfig.Timeout != 10*time.Second {
		t.Errorf("client restConfig.Timeout = %s, want 10s", client.restConfig.Timeout)
	}
	if incoming.Timeout != 0 {
		t.Errorf("incoming config was mutated: Timeout = %s, want 0 (it feeds the informers)", incoming.Timeout)
	}
	if client.logsConfig == nil {
		t.Fatal("pod-log stream config must be set")
	}
	if client.logsConfig.Timeout != 0 {
		t.Errorf("pod-log config Timeout = %s, want 0 (streams must not be cut short)", client.logsConfig.Timeout)
	}

	// A preconfigured, tighter timeout is preserved, not loosened to the configured one.
	preconfigured := &rest.Config{Host: "http://127.0.0.1:1", Timeout: time.Second}
	client, err = NewClient(ClusterInfo{ClientConfig: preconfigured, Name: "remote"}, conf)
	if err != nil {
		t.Fatalf("NewClient failed: %v", err)
	}
	if client.restConfig.Timeout != time.Second {
		t.Errorf("client restConfig.Timeout = %s, want the preconfigured 1s", client.restConfig.Timeout)
	}

	// A longer incoming timeout is clamped to the configured bound.
	preconfigured = &rest.Config{Host: "http://127.0.0.1:1", Timeout: time.Minute}
	client, err = NewClient(ClusterInfo{ClientConfig: preconfigured, Name: "remote"}, conf)
	if err != nil {
		t.Fatalf("NewClient failed: %v", err)
	}
	if client.restConfig.Timeout != 10*time.Second {
		t.Errorf("client restConfig.Timeout = %s, want the configured 10s bound", client.restConfig.Timeout)
	}

	// Zero disables the timeout entirely.
	conf = timeoutTestConfig(0)
	client, err = NewClient(ClusterInfo{ClientConfig: &rest.Config{Host: "http://127.0.0.1:1"}, Name: "remote"}, conf)
	if err != nil {
		t.Fatalf("NewClient failed: %v", err)
	}
	if client.restConfig.Timeout != 0 {
		t.Errorf("client restConfig.Timeout = %s, want 0 (disabled)", client.restConfig.Timeout)
	}
}

// TestStreamPodLogsOutlivesRequestTimeout pins the pod-log exemption: with a request timeout
// that would cut a slow stream, StreamPodLogs keeps reading (it is served by the timeout-free
// client) while the caller's context still cancels it.
func TestStreamPodLogsOutlivesRequestTimeout(t *testing.T) {
	// A server that drips log lines slower than the request timeout.
	dripInterval := 150 * time.Millisecond
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		flusher := w.(http.Flusher)
		for i := 0; i < 3; i++ {
			_, _ = w.Write([]byte("log-line\n"))
			flusher.Flush()
			if i < 2 {
				time.Sleep(dripInterval)
			}
		}
	}))
	t.Cleanup(server.Close)

	conf := timeoutTestConfig(100 * time.Millisecond)
	client, err := NewClient(ClusterInfo{ClientConfig: &rest.Config{Host: server.URL}, Name: "home"}, conf)
	if err != nil {
		t.Fatalf("NewClient failed: %v", err)
	}

	start := time.Now()
	reader, err := client.StreamPodLogs(context.Background(), "ns", "pod", &corev1.PodLogOptions{})
	if err != nil {
		t.Fatalf("StreamPodLogs failed: %v", err)
	}
	body, err := io.ReadAll(reader)
	elapsed := time.Since(start)
	if err != nil {
		t.Fatalf("reading the log stream failed: %v", err)
	}
	if len(body) == 0 {
		t.Error("expected log output")
	}
	// 3 lines with 2 gaps of 150ms each must exceed the 100ms request timeout; if the stream
	// were served by the timeout-bearing client it would have been cut.
	if elapsed < 2*dripInterval {
		t.Errorf("stream finished in %s, expected it to outlive the 100ms request timeout", elapsed)
	}
}

// shortHeaderDeadlineConf builds a config whose pod-log establishment deadline is short
// enough to test against; pass it to NewClient so the client under test carries it.
func shortHeaderDeadlineConf(t *testing.T) (*config.Config, time.Duration) {
	t.Helper()
	conf := config.NewConfig()
	conf.KialiInternal.KubernetesClient.PodLogHeaderTimeout = 250 * time.Millisecond
	return conf, conf.KialiInternal.KubernetesClient.PodLogHeaderTimeout
}

// TestStreamPodLogsWithExecProvider pins the #10545 regression: a remote whose kubeconfig
// authenticates through an exec credential plugin must still be able to stream pod logs.
// The log client must be built by client-go itself (a custom transport makes client-go
// reject the exec provider's certificate callback), and the establishment deadline must
// not cut a stream whose headers already arrived.
func TestStreamPodLogsWithExecProvider(t *testing.T) {
	conf, deadline := shortHeaderDeadlineConf(t)

	// The exec plugin emits a static ExecCredential bearing the token.
	const execToken = "exec-provider-token"
	credential := fmt.Sprintf(`{"kind":"ExecCredential","apiVersion":"client.authentication.k8s.io/v1","status":{"token":%q}}`, execToken)
	execConfig := &api.ExecConfig{
		Command:         "printf",
		Args:            []string{"%s", credential},
		APIVersion:      "client.authentication.k8s.io/v1",
		InteractiveMode: api.NeverExecInteractiveMode,
	}

	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer "+execToken {
			t.Errorf("pod log request authorized as %q, want the exec provider's token", got)
		}
		w.Header().Set("Content-Type", "text/plain")
		flusher := w.(http.Flusher)
		flusher.Flush() // headers arrive: the establishment deadline must stop here
		// The log line is emitted well after the establishment deadline; an established
		// stream must keep reading it.
		time.Sleep(3 * deadline)
		_, _ = w.Write([]byte("after-deadline-line\n"))
		flusher.Flush()
	}))
	t.Cleanup(server.Close)

	cfg := &rest.Config{
		Host:         server.URL,
		ExecProvider: execConfig,
		TLSClientConfig: rest.TLSClientConfig{
			CAData: pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: server.Certificate().Raw}),
		},
	}
	client, err := NewClient(ClusterInfo{ClientConfig: cfg, Name: "remote"}, conf)
	if err != nil {
		t.Fatalf("NewClient failed: %v", err)
	}

	reader, err := client.StreamPodLogs(context.Background(), "ns", "pod", &corev1.PodLogOptions{})
	if err != nil {
		t.Fatalf("StreamPodLogs failed with an exec-authenticated remote: %v", err)
	}
	body, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("reading the log stream failed: %v", err)
	}
	if string(body) != "after-deadline-line\n" {
		t.Errorf("log stream body = %q, want the line emitted after the establishment deadline", body)
	}
}

// TestStreamPodLogsHeaderTimeout verifies the establishment bound from the failing side: a
// peer that accepts the request but never answers must fail StreamPodLogs within the
// deadline, and the peer must observe the request's cancellation.
func TestStreamPodLogsHeaderTimeout(t *testing.T) {
	conf, deadline := shortHeaderDeadlineConf(t)

	cancelled := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Accept the request but never answer; report when the client gives up.
		<-r.Context().Done()
		close(cancelled)
	}))
	t.Cleanup(server.Close)

	client, err := NewClient(ClusterInfo{ClientConfig: &rest.Config{Host: server.URL}, Name: "remote"}, conf)
	if err != nil {
		t.Fatalf("NewClient failed: %v", err)
	}

	start := time.Now()
	_, err = client.StreamPodLogs(context.Background(), "ns", "pod", &corev1.PodLogOptions{})
	elapsed := time.Since(start)
	if err == nil {
		t.Fatal("StreamPodLogs must fail when the peer never answers")
	}
	if want := "timed out after"; !strings.Contains(err.Error(), want) {
		t.Errorf("error %q does not report the establishment timeout", err)
	}
	if elapsed > 5*deadline {
		t.Errorf("StreamPodLogs took %s to fail, want ~%s", elapsed, deadline)
	}
	select {
	case <-cancelled:
	case <-time.After(5 * time.Second):
		t.Error("the server did not observe the request's cancellation")
	}
}

// TestStreamPodLogsCallerCancelCutsStream verifies the other direction: once the stream is
// established, the caller's context still governs it - cancelling after the headers arrive
// must cut the body and unblock the server.
func TestStreamPodLogsCallerCancelCutsStream(t *testing.T) {
	conf, _ := shortHeaderDeadlineConf(t)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		flusher := w.(http.Flusher)
		flusher.Flush()
		<-r.Context().Done() // hold the established stream open until the caller goes away
	}))
	t.Cleanup(server.Close)

	client, err := NewClient(ClusterInfo{ClientConfig: &rest.Config{Host: server.URL}, Name: "remote"}, conf)
	if err != nil {
		t.Fatalf("NewClient failed: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	reader, err := client.StreamPodLogs(ctx, "ns", "pod", &corev1.PodLogOptions{})
	if err != nil {
		t.Fatalf("StreamPodLogs failed: %v", err)
	}
	cancel()
	if _, err := io.ReadAll(reader); err == nil {
		t.Error("reading the body after the caller cancelled must fail, not hang or return cleanly")
	}
}

// TestCapabilityProbeBackoffAndMemoization covers the transient-failure handling: a stalled
// remote fails the probe without memoizing (so a later call retries), a back-to-back call
// within the backoff window does not re-probe, and a definitive 404 memoizes.
func TestCapabilityProbeBackoffAndMemoization(t *testing.T) {
	var requests int
	newServer := func(status int) *httptest.Server {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			requests++
			w.WriteHeader(status)
			if status == http.StatusNotFound {
				_ = json.NewEncoder(w).Encode(&struct {
					Kind   string `json:"kind"`
					Code   int    `json:"code"`
					Status string `json:"status"`
				}{Kind: "Status", Code: status, Status: "Failure"})
			}
		}))
		t.Cleanup(server.Close)
		return server
	}

	// Transient server errors (500): the probe answers false, does not memoize, and the
	// back-to-back call is suppressed by the backoff (one request total).
	server := newServer(http.StatusInternalServerError)
	client, err := NewClient(ClusterInfo{ClientConfig: &rest.Config{Host: server.URL}, Name: "home"}, config.NewConfig())
	if err != nil {
		t.Fatalf("NewClient failed: %v", err)
	}
	if client.IsOpenShift() {
		t.Error("a 500ing discovery endpoint must not report OpenShift")
	}
	if client.IsOpenShift() {
		t.Error("a 500ing discovery endpoint must not report OpenShift on retry either")
	}
	if requests != 1 {
		t.Errorf("probe made %d requests, want 1 (second call backed off)", requests)
	}
	if client.isOpenShift != nil {
		t.Error("a transient failure must not be memoized")
	}

	// A 404 on the platform endpoint is a definitive "not an OpenShift cluster" on a healthy
	// Kubernetes API server: it is memoized (no re-probing on the request path), unlike a
	// transport failure.
	requests = 0
	server = newServer(http.StatusNotFound)
	client, err = NewClient(ClusterInfo{ClientConfig: &rest.Config{Host: server.URL}, Name: "home"}, config.NewConfig())
	if err != nil {
		t.Fatalf("NewClient failed: %v", err)
	}
	for i := 0; i < 3; i++ {
		if client.IsOpenShift() {
			t.Error("a 404 must report not-OpenShift")
		}
	}
	if requests != 1 {
		t.Errorf("probe made %d requests, want 1 (platform 404 is memoized)", requests)
	}
	if client.isOpenShift == nil || *client.isOpenShift {
		t.Error("a platform 404 must memoize false - it is a definitive answer, not a transient one")
	}

	// Backoff expiry: simulate by rewinding the recorded failure.
	requests = 0
	server = newServer(http.StatusInternalServerError)
	client, err = NewClient(ClusterInfo{ClientConfig: &rest.Config{Host: server.URL}, Name: "home"}, config.NewConfig())
	if err != nil {
		t.Fatalf("NewClient failed: %v", err)
	}
	_ = client.IsOpenShift()
	client.rwMutex.Lock()
	if client.probeFailures == nil {
		client.probeFailures = map[string]time.Time{}
	}
	client.probeFailures["openShift"] = time.Now().Add(-2 * capabilityProbeBackoff)
	client.rwMutex.Unlock()
	_ = client.IsOpenShift()
	if requests != 2 {
		t.Errorf("probe made %d requests, want 2 (retry after backoff expiry)", requests)
	}
}

// TestCapabilityProbeCtxDeadlineAbandoned covers the context-aware capability probes: a
// probe abandoned at the caller's deadline answers false without memoizing (a later call
// retries), and once the peer answers the same client discovers the capability without a
// restart. This is the retry path the config handler relies on when it bounds discovery.
func TestCapabilityProbeCtxDeadlineAbandoned(t *testing.T) {
	var stalled sync.Once
	stallReleased := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// The very first discovery request is accepted but never answered; the caller's
		// deadline abandons it. Every later request is answered.
		stalled.Do(func() {
			<-r.Context().Done()
			close(stallReleased)
		})
		list := &meta_v1.APIResourceList{APIResources: []meta_v1.APIResource{
			{Kind: K8sGatewayType, Name: PluralNames[K8sGatewayType]},
			{Kind: K8sGatewayClassType, Name: PluralNames[K8sGatewayClassType]},
			{Kind: K8sHTTPRouteType, Name: PluralNames[K8sHTTPRouteType]},
			{Kind: K8sGRPCRouteType, Name: PluralNames[K8sGRPCRouteType]},
		}}
		if strings.HasSuffix(r.URL.Path, "v1beta1") {
			list = &meta_v1.APIResourceList{APIResources: []meta_v1.APIResource{
				{Kind: K8sReferenceGrantType, Name: PluralNames[K8sReferenceGrantType]},
			}}
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(list)
	}))
	t.Cleanup(server.Close)

	client, err := NewClient(ClusterInfo{ClientConfig: &rest.Config{Host: server.URL}, Name: "remote"}, config.NewConfig())
	if err != nil {
		t.Fatalf("NewClient failed: %v", err)
	}

	// A deadline that expires mid-probe: the answer is false and not memoized.
	ctx, cancel := context.WithTimeout(context.Background(), 250*time.Millisecond)
	defer cancel()
	if client.IsGatewayAPIContext(ctx) {
		t.Error("an abandoned probe must not report Gateway API")
	}
	select {
	case <-stallReleased:
	case <-time.After(5 * time.Second):
		t.Fatal("the stalled request was not abandoned")
	}
	client.rwMutex.Lock()
	if client.isGatewayAPI != nil {
		t.Error("an abandoned probe must not memoize")
	}
	// Rewind the transient-failure backoff so the retry is immediate.
	if client.probeFailures == nil {
		client.probeFailures = map[string]time.Time{}
	}
	client.probeFailures["gatewayAPI"] = time.Now().Add(-2 * capabilityProbeBackoff)
	client.rwMutex.Unlock()

	// With the peer answering, the same client discovers the capability.
	if !client.IsGatewayAPIContext(context.Background()) {
		t.Error("the probe must succeed against the answering peer")
	}
}

func TestRemoteExecCredentialStallHonorsDeadline(t *testing.T) {
	dir := t.TempDir()
	ready := filepath.Join(dir, "release")
	// Release the helper even if a regression makes the request ignore cancellation.
	watchdog := time.AfterFunc(5*time.Second, func() { _ = os.WriteFile(ready, nil, 0600) })
	defer watchdog.Stop()
	defer func() { _ = os.WriteFile(ready, nil, 0600) }()
	command := filepath.Join(dir, "credentials")
	err := os.WriteFile(command, []byte(`#!/bin/sh
while [ ! -f "$1" ]; do sleep 0.02; done
echo '{"kind":"ExecCredential","apiVersion":"client.authentication.k8s.io/v1","status":{"token":"fixture"}}'
`), 0700)
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"kind":"SelfSubjectAccessReview","apiVersion":"authorization.k8s.io/v1","status":{"allowed":true}}`)
	}))
	defer server.Close()
	client, err := NewClient(ClusterInfo{Name: "remote", ClientConfig: &rest.Config{Host: server.URL, ExecProvider: &api.ExecConfig{APIVersion: "client.authentication.k8s.io/v1", Command: command, Args: []string{ready}, InteractiveMode: api.NeverExecInteractiveMode}}}, timeoutTestConfig(time.Second))
	if err != nil {
		t.Fatal(err)
	}
	start := time.Now()
	for range 2 {
		ctx, cancel := context.WithTimeout(t.Context(), 50*time.Millisecond)
		_, err = client.GetSelfSubjectAccessReview(ctx, "", "apps", "deployments", []string{"list"})
		cancel()
		if !errors.Is(err, context.DeadlineExceeded) {
			t.Fatalf("expected probe deadline, got %v", err)
		}
	}
	require.Less(t, time.Since(start), 2*time.Second, "the requests must finish while the helper is still blocked")
	if err := os.WriteFile(ready, nil, 0600); err != nil {
		t.Fatal(err)
	}
	_, err = client.GetSelfSubjectAccessReview(t.Context(), "", "apps", "deployments", []string{"list"})
	if err != nil {
		t.Fatal(err)
	}
}

func TestCapabilityDeadlineDuringPlatformProbe(t *testing.T) {
	entered, release := make(chan struct{}), make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/apis/project.openshift.io" {
			close(entered)
			<-release
		}
		http.NotFound(w, r)
	}))
	defer server.Close()
	defer close(release)
	client, err := NewClient(ClusterInfo{Name: "remote", ClientConfig: &rest.Config{Host: server.URL}}, config.NewConfig())
	require.NoError(t, err)
	go client.IsOpenShift()
	select {
	case <-entered:
	case <-time.After(time.Second):
		t.Fatal("platform probe never started")
	}
	ctx, cancel := context.WithTimeout(t.Context(), 100*time.Millisecond)
	defer cancel()
	done := make(chan bool, 1)
	go func() { done <- client.IsGatewayAPIContext(ctx) }()
	select {
	case result := <-done:
		require.False(t, result)
	case <-time.After(time.Second):
		t.Fatal("gateway discovery blocked on the platform probe")
	}
}

type blockedCredentialRoundTripper struct {
	calls   atomic.Int32
	entered chan struct{}
	release chan struct{}
}

func (b *blockedCredentialRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	if b.calls.Add(1) == 1 {
		close(b.entered)
	}
	<-b.release
	return nil, req.Context().Err()
}

func TestExecCredentialRetriesWaitForOutstandingRequest(t *testing.T) {
	base := &blockedCredentialRoundTripper{entered: make(chan struct{}), release: make(chan struct{})}
	defer close(base.release)
	transport := &execCredentialTransport{base: base}
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	req := httptest.NewRequestWithContext(ctx, http.MethodGet, "/", nil)
	first := make(chan error, 1)
	go func() { _, err := transport.RoundTrip(req); first <- err }()
	<-base.entered
	cancel()
	require.ErrorIs(t, <-first, context.Canceled)

	retry, stop := context.WithTimeout(t.Context(), 100*time.Millisecond)
	defer stop()
	_, err := transport.RoundTrip(req.Clone(retry))
	require.ErrorIs(t, err, context.DeadlineExceeded)
	require.EqualValues(t, 1, base.calls.Load(), "a retry must not launch another blocked worker")
}

func TestCapabilityWaiterCanLeaveSharedProbe(t *testing.T) {
	var requests atomic.Int32
	entered, release := make(chan struct{}), make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if requests.Add(1) == 1 {
			close(entered)
		}
		<-release
		http.NotFound(w, r)
	}))
	defer server.Close()
	defer close(release)
	client, err := NewClient(ClusterInfo{Name: "remote", ClientConfig: &rest.Config{Host: server.URL}}, config.NewConfig())
	require.NoError(t, err)
	go client.IsGatewayAPIContext(t.Context())
	select {
	case <-entered:
	case <-time.After(2 * time.Second):
		t.Fatal("gateway probe never started")
	}
	ctx, cancel := context.WithTimeout(t.Context(), 50*time.Millisecond)
	defer cancel()
	done := make(chan bool, 1)
	go func() { done <- client.IsGatewayAPIContext(ctx) }()
	select {
	case present := <-done:
		require.False(t, present)
		require.ErrorIs(t, ctx.Err(), context.DeadlineExceeded)
		require.EqualValues(t, 1, requests.Load())
	case <-time.After(2 * time.Second):
		t.Fatal("a waiter could not leave the shared gateway probe")
	}
}
