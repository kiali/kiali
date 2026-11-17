package httputil

import (
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/kiali/kiali/config"
)

// These tests verify that HTTP clients built through CreateTransport - and the
// HttpGet/HttpPost helpers that Kiali's outbound API calls go through (tracing,
// istio status, versions, grafana/perses dashboards, prometheus health, ...) -
// honor the standard proxy environment variables HTTP_PROXY, HTTPS_PROXY and
// NO_PROXY, as they would when a user sets them on the Kiali pod via
// deployment custom_envs.
//
// Two net/http behaviors shape the test design:
//
//  1. The proxy env vars are snapshotted on first use and never re-read
//     (envProxyFunc's sync.Once in net/http), so TestMain sets them before any
//     test runs. HTTP_PROXY and HTTPS_PROXY point at two distinct local test
//     proxies so each variable is proven independently.
//  2. Requests to loopback addresses are never proxied (httpproxy's useProxy),
//     so the env vars cannot disturb the other tests in this package, which
//     talk to httptest servers on 127.0.0.1. It also means these tests cannot
//     use 127.0.0.1 as the request destination: instead they use fake
//     ".example" hostnames (RFC 2606, guaranteed unresolvable). A client that
//     honors the env vars hands those names to the proxy in absolute form and
//     never resolves them itself; the test proxies rewrite the host to
//     127.0.0.1 (keeping the port) so requests reach real httptest backends.

const (
	// proxiedAPIHost is not listed in NO_PROXY: requests to it must go through HTTP_PROXY.
	proxiedAPIHost = "proxied-api.example"
	// secureAPIHost is not listed in NO_PROXY: requests to it must go through HTTPS_PROXY.
	secureAPIHost = "secure-api.example"
	// noProxyTestHost is listed in NO_PROXY: requests to it must bypass the proxy.
	noProxyTestHost = "direct-unproxied.example"
)

var (
	testHTTPProxy  *envTestProxy
	testHTTPSProxy *envTestProxy
)

func TestMain(m *testing.M) {
	testHTTPProxy = newEnvTestProxy()
	testHTTPSProxy = newEnvTestProxy()

	// net/http prefers the uppercase names, but unset the lowercase variants
	// anyway so a developer's shell cannot leak a different value in.
	for _, name := range []string{"http_proxy", "https_proxy", "no_proxy"} {
		os.Unsetenv(name)
	}
	os.Setenv("HTTP_PROXY", "http://"+testHTTPProxy.addr)
	os.Setenv("HTTPS_PROXY", "http://"+testHTTPSProxy.addr)
	os.Setenv("NO_PROXY", noProxyTestHost)

	code := m.Run()
	testHTTPProxy.server.Close()
	testHTTPSProxy.server.Close()
	os.Exit(code)
}

// envTestProxy is a local HTTP proxy for the proxy env var tests. It accepts
// absolute-form requests and CONNECT tunnels, rewriting the destination host
// to 127.0.0.1 while keeping the port, so fake hostnames can be pointed at
// real httptest backends. It stamps forwarded requests with
// X-Via-Env-Test-Proxy so backends can prove the request actually transited
// the proxy.
type envTestProxy struct {
	server *httptest.Server
	addr   string

	mu       sync.Mutex
	hits     int
	lastHost string
	connects []string
}

// The proxy's own forwarding client deliberately uses a zero-value
// http.Transport (nil Proxy): it must not consult the env vars, otherwise
// forwarding would loop back through the proxies under test.
var envTestProxyClient = &http.Client{
	Transport: &http.Transport{DisableKeepAlives: true},
	Timeout:   10 * time.Second,
}

func newEnvTestProxy() *envTestProxy {
	p := &envTestProxy{}
	p.server = httptest.NewServer(http.HandlerFunc(p.handle))
	p.addr = strings.TrimPrefix(p.server.URL, "http://")
	return p
}

func (p *envTestProxy) handle(w http.ResponseWriter, r *http.Request) {
	p.mu.Lock()
	p.hits++
	p.lastHost = r.Host
	if r.Method == http.MethodConnect {
		p.connects = append(p.connects, r.Host)
	}
	p.mu.Unlock()

	if r.Method == http.MethodConnect {
		p.tunnel(w, r)
		return
	}

	// Absolute-form request: rewrite the host to loopback and forward.
	_, port, err := net.SplitHostPort(r.Host)
	if err != nil {
		http.Error(w, "bad proxied host: "+err.Error(), http.StatusBadRequest)
		return
	}
	r.URL.Host = net.JoinHostPort("127.0.0.1", port)
	r.RequestURI = ""
	r.Header.Set("X-Via-Env-Test-Proxy", "true")
	resp, err := envTestProxyClient.Do(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	for k, vv := range resp.Header {
		for _, v := range vv {
			w.Header().Add(k, v)
		}
	}
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

// tunnel implements the CONNECT method: dial the real backend on loopback and
// pipe bytes both ways until either side closes.
func (p *envTestProxy) tunnel(w http.ResponseWriter, r *http.Request) {
	hostPort := r.Host
	if hostPort == "" {
		hostPort = r.URL.Host
	}
	_, port, err := net.SplitHostPort(hostPort)
	if err != nil {
		http.Error(w, "bad CONNECT target: "+err.Error(), http.StatusBadRequest)
		return
	}
	backend, err := net.Dial("tcp", net.JoinHostPort("127.0.0.1", port))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	defer backend.Close()

	hijacker, ok := w.(http.Hijacker)
	if !ok {
		http.Error(w, "proxy does not support hijacking", http.StatusInternalServerError)
		return
	}
	client, _, err := hijacker.Hijack()
	if err != nil {
		return
	}
	defer client.Close()

	if _, err := client.Write([]byte("HTTP/1.1 200 Connection Established\r\n\r\n")); err != nil {
		return
	}
	go func() {
		_, _ = io.Copy(backend, client)
		backend.Close()
	}()
	_, _ = io.Copy(client, backend)
}

func (p *envTestProxy) hitCount() int {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.hits
}

func (p *envTestProxy) lastSeenHost() string {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.lastHost
}

func (p *envTestProxy) connectTargets() []string {
	p.mu.Lock()
	defer p.mu.Unlock()
	return append([]string(nil), p.connects...)
}

// newProxyTestConf returns a Config usable with CreateTransport in tests.
func newProxyTestConf(t *testing.T) *config.Config {
	t.Helper()
	conf := config.NewConfig()
	cm, err := config.NewCredentialManager(nil)
	if err != nil {
		t.Fatalf("credential manager: %v", err)
	}
	t.Cleanup(cm.Close)
	conf.Credentials = cm
	return conf
}

func proxyTestPort(t *testing.T, serverURL string) string {
	t.Helper()
	u, err := url.Parse(serverURL)
	if err != nil {
		t.Fatalf("parse server URL: %v", err)
	}
	_, port, err := net.SplitHostPort(u.Host)
	if err != nil {
		t.Fatalf("split server host: %v", err)
	}
	return port
}

// TestCreateTransport_HonorsProxyEnvVars verifies at the transport level that
// a transport built by CreateTransport with no explicit Proxy consults all
// three proxy environment variables.
func TestCreateTransport_HonorsProxyEnvVars(t *testing.T) {
	conf := newProxyTestConf(t)
	rt, err := CreateTransport(conf, nil, &http.Transport{}, 5*time.Second, nil)
	if err != nil {
		t.Fatalf("CreateTransport: %v", err)
	}
	tr, ok := rt.(*http.Transport)
	if !ok {
		t.Fatalf("expected *http.Transport, got %T", rt)
	}
	if tr.Proxy == nil {
		t.Fatal("transport built by CreateTransport has no Proxy function: HTTP_PROXY/HTTPS_PROXY/NO_PROXY are ignored")
	}

	reqFor := func(rawURL string) *http.Request {
		t.Helper()
		req, err := http.NewRequest(http.MethodGet, rawURL, nil)
		if err != nil {
			t.Fatalf("new request: %v", err)
		}
		return req
	}

	// HTTP_PROXY must apply to plain http requests.
	proxyURL, err := tr.Proxy(reqFor("http://" + proxiedAPIHost + ":9090/api"))
	if err != nil {
		t.Fatalf("Proxy(http) error: %v", err)
	}
	if proxyURL == nil || proxyURL.String() != "http://"+testHTTPProxy.addr {
		t.Fatalf("expected http request to use HTTP_PROXY %q, got %v", testHTTPProxy.addr, proxyURL)
	}

	// HTTPS_PROXY must apply to https requests.
	proxyURL, err = tr.Proxy(reqFor("https://" + secureAPIHost + ":8443/api"))
	if err != nil {
		t.Fatalf("Proxy(https) error: %v", err)
	}
	if proxyURL == nil || proxyURL.String() != "http://"+testHTTPSProxy.addr {
		t.Fatalf("expected https request to use HTTPS_PROXY %q, got %v", testHTTPSProxy.addr, proxyURL)
	}

	// NO_PROXY must exclude the listed host from proxying.
	proxyURL, err = tr.Proxy(reqFor("http://" + noProxyTestHost + ":9090/api"))
	if err != nil {
		t.Fatalf("Proxy(no_proxy) error: %v", err)
	}
	if proxyURL != nil {
		t.Fatalf("expected no proxy for the NO_PROXY host, got %v", proxyURL)
	}
}

// TestCreateTransport_PreservesCustomProxy verifies that a caller-supplied
// Proxy function is not overridden by the env var default (prometheus, grafana
// and perses rely on passing their own).
func TestCreateTransport_PreservesCustomProxy(t *testing.T) {
	conf := newProxyTestConf(t)
	sentinel := &url.URL{Scheme: "http", Host: "sentinel-proxy.example:3128"}
	transport := &http.Transport{
		Proxy: func(*http.Request) (*url.URL, error) { return sentinel, nil },
	}
	rt, err := CreateTransport(conf, nil, transport, 5*time.Second, nil)
	if err != nil {
		t.Fatalf("CreateTransport: %v", err)
	}
	tr, ok := rt.(*http.Transport)
	if !ok {
		t.Fatalf("expected *http.Transport, got %T", rt)
	}

	req, err := http.NewRequest(http.MethodGet, "http://"+proxiedAPIHost+":9090/api", nil)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	got, err := tr.Proxy(req)
	if err != nil {
		t.Fatalf("Proxy error: %v", err)
	}
	if got != sentinel {
		t.Fatalf("expected caller-supplied Proxy to be preserved, got %v", got)
	}
}

// TestHttpGet_HonorsHTTPProxyEnvVar is an end-to-end check that a GET issued
// through HttpGet to a proxyable host is routed via HTTP_PROXY and reaches the
// backend through it.
func TestHttpGet_HonorsHTTPProxyEnvVar(t *testing.T) {
	conf := newProxyTestConf(t)
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "via-proxy=%s", r.Header.Get("X-Via-Env-Test-Proxy"))
	}))
	defer target.Close()

	targetPort := proxyTestPort(t, target.URL)
	requestURL := "http://" + proxiedAPIHost + ":" + targetPort + "/api/mock"

	httpHitsBefore := testHTTPProxy.hitCount()
	httpsHitsBefore := testHTTPSProxy.hitCount()

	body, code, _, err := HttpGet(requestURL, nil, 10*time.Second, nil, nil, conf)
	if err != nil {
		t.Fatalf("HttpGet: %v", err)
	}
	if code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", code)
	}
	if got := string(body); got != "via-proxy=true" {
		t.Fatalf("expected backend to see the request via the proxy, got body %q", got)
	}
	if testHTTPProxy.hitCount() != httpHitsBefore+1 {
		t.Fatalf("expected exactly one new HTTP_PROXY hit, got %d", testHTTPProxy.hitCount()-httpHitsBefore)
	}
	if last := testHTTPProxy.lastSeenHost(); last != proxiedAPIHost+":"+targetPort {
		t.Fatalf("expected proxy to see host %s, got %q", proxiedAPIHost+":"+targetPort, last)
	}
	if testHTTPSProxy.hitCount() != httpsHitsBefore {
		t.Fatalf("http request must not use HTTPS_PROXY, got %d new hits", testHTTPSProxy.hitCount()-httpsHitsBefore)
	}
}

// TestHttpPost_HonorsHTTPProxyEnvVar is the POST counterpart of the HttpGet
// end-to-end check.
func TestHttpPost_HonorsHTTPProxyEnvVar(t *testing.T) {
	conf := newProxyTestConf(t)
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reqBody, _ := io.ReadAll(r.Body)
		fmt.Fprintf(w, "%s|%s", r.Method, string(reqBody))
	}))
	defer target.Close()

	targetPort := proxyTestPort(t, target.URL)
	requestURL := "http://" + proxiedAPIHost + ":" + targetPort + "/api/submit"

	httpHitsBefore := testHTTPProxy.hitCount()

	body, code, _, err := HttpPost(requestURL, nil, strings.NewReader("hello-proxy"), 10*time.Second, nil, conf)
	if err != nil {
		t.Fatalf("HttpPost: %v", err)
	}
	if code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", code)
	}
	if got := string(body); got != "POST|hello-proxy" {
		t.Fatalf("expected backend to see POST|hello-proxy, got %q", got)
	}
	if testHTTPProxy.hitCount() != httpHitsBefore+1 {
		t.Fatalf("expected exactly one new HTTP_PROXY hit, got %d", testHTTPProxy.hitCount()-httpHitsBefore)
	}
}

// TestHttpGet_HonorsNoProxyEnvVar verifies that a host listed in NO_PROXY is
// dialed directly, bypassing the proxy. The destination is unresolvable, so a
// direct attempt must fail with a client-side dial error while leaving the
// proxy untouched. (If the request were incorrectly sent to the proxy, the
// proxy would forward it and answer 502, which HttpGet reports as a status
// code, not an error.) Note this test alone cannot distinguish "NO_PROXY
// honored" from "env vars ignored entirely"; it is the pairing with the
// HTTP_PROXY/HTTPS_PROXY routing tests plus the transport-level NO_PROXY
// assertion above that proves the exclusion is due to NO_PROXY.
func TestHttpGet_HonorsNoProxyEnvVar(t *testing.T) {
	conf := newProxyTestConf(t)
	requestURL := "http://" + noProxyTestHost + ":1/unreachable"

	httpHitsBefore := testHTTPProxy.hitCount()
	httpsHitsBefore := testHTTPSProxy.hitCount()

	_, _, _, err := HttpGet(requestURL, nil, 5*time.Second, nil, nil, conf)
	if err == nil {
		t.Fatal("expected a dial error for the unresolvable NO_PROXY host, got success")
	}
	if testHTTPProxy.hitCount() != httpHitsBefore || testHTTPSProxy.hitCount() != httpsHitsBefore {
		t.Fatalf("request for NO_PROXY host must not touch the proxies, got %d/%d new hits",
			testHTTPProxy.hitCount()-httpHitsBefore, testHTTPSProxy.hitCount()-httpsHitsBefore)
	}
}

// TestHttpGet_HonorsHTTPSProxyEnvVar is an end-to-end check that an https GET
// issued through HttpGet is routed via HTTPS_PROXY using CONNECT tunneling.
// InsecureSkipVerify is used because the test backend's certificate is
// self-signed; it does not affect proxy routing.
func TestHttpGet_HonorsHTTPSProxyEnvVar(t *testing.T) {
	conf := newProxyTestConf(t)
	// Note: the backend cannot see X-Via-Env-Test-Proxy here - with CONNECT the
	// proxy only tunnels encrypted bytes - so proxy transit is proven by the
	// CONNECT recorded on the proxy below.
	target := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, "secure-ok")
	}))
	defer target.Close()

	targetPort := proxyTestPort(t, target.URL)
	requestURL := "https://" + secureAPIHost + ":" + targetPort + "/api/tls"

	httpHitsBefore := testHTTPProxy.hitCount()
	httpsHitsBefore := testHTTPSProxy.hitCount()

	body, code, _, err := HttpGet(requestURL, &config.Auth{InsecureSkipVerify: true}, 15*time.Second, nil, nil, conf)
	if err != nil {
		t.Fatalf("HttpGet: %v", err)
	}
	if code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", code)
	}
	if got := string(body); got != "secure-ok" {
		t.Fatalf("expected response body from the TLS backend, got %q", got)
	}
	if testHTTPSProxy.hitCount() != httpsHitsBefore+1 {
		t.Fatalf("expected exactly one new HTTPS_PROXY hit, got %d", testHTTPSProxy.hitCount()-httpsHitsBefore)
	}
	connects := testHTTPSProxy.connectTargets()
	if len(connects) == 0 || connects[len(connects)-1] != secureAPIHost+":"+targetPort {
		t.Fatalf("expected CONNECT for %s, got %v", secureAPIHost+":"+targetPort, connects)
	}
	if testHTTPProxy.hitCount() != httpHitsBefore {
		t.Fatalf("https request must not use HTTP_PROXY, got %d new hits", testHTTPProxy.hitCount()-httpHitsBefore)
	}
}
