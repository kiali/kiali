package business

import (
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"
)

// TestMain pins the proxy environment for the whole package. net/http reads
// HTTP_PROXY/HTTPS_PROXY/NO_PROXY once per process (on first use) and never
// re-reads them, so they must be set before any test runs. The variables point
// at local test proxies so tests can verify that HTTP clients honor them (see
// TestHttpClientWithPool_HonorsProxyEnvVars).
//
// This does not affect tests that talk to httptest servers on 127.0.0.1:
// requests to loopback addresses are never proxied by Go.
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

const (
	// secureAPIHost is not listed in NO_PROXY: requests to it must go through HTTPS_PROXY.
	secureAPIHost = "secure-api.example"
	// noProxyTestHost is listed in NO_PROXY: requests to it must bypass the proxy.
	noProxyTestHost = "direct-unproxied.example"
)

var (
	testHTTPProxy  *envTestProxy
	testHTTPSProxy *envTestProxy
)

// envTestProxy is a local HTTP proxy for proxy env var tests. It accepts
// absolute-form requests and CONNECT tunnels, rewriting the destination host
// to 127.0.0.1 while keeping the port, so unresolvable ".example" hostnames
// (RFC 2606) can be pointed at real httptest backends: a client that honors
// the env vars hands those names to the proxy and never resolves them itself.
type envTestProxy struct {
	server *httptest.Server
	addr   string

	mu       sync.Mutex
	hits     int
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

func (p *envTestProxy) connectTargets() []string {
	p.mu.Lock()
	defer p.mu.Unlock()
	return append([]string(nil), p.connects...)
}
