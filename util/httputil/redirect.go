package httputil

import (
	"errors"
	"net/http"
	"net/url"
	"strings"
)

type RedirectPolicy func(req *http.Request, via []*http.Request) error

var ErrRedirectOrigin = errors.New("redirect changes the destination origin")

func SameOriginRedirect(req *http.Request, via []*http.Request) error {
	return checkProbeRedirect(req, via, false)
}

// AnonymousDiscoveryRedirect allows a direct HTTPS upgrade on the same host.
// Only use this policy for probes that carry no backend credentials.
func AnonymousDiscoveryRedirect(req *http.Request, via []*http.Request) error {
	return checkProbeRedirect(req, via, true)
}

func checkProbeRedirect(req *http.Request, via []*http.Request, allowUpgrade bool) error {
	if len(via) >= 5 {
		return errors.New("too many redirects")
	}
	from, to := via[len(via)-1].URL, req.URL
	if to.User != nil || to.Opaque != "" || !strings.EqualFold(from.Hostname(), to.Hostname()) {
		return ErrRedirectOrigin
	}
	if SameOrigin(from, to) {
		return nil
	}

	fromPort, toPort := redirectPort(from), redirectPort(to)
	if allowUpgrade && from.Scheme == "http" && to.Scheme == "https" &&
		(fromPort == toPort || (fromPort == "80" && toPort == "443")) {
		return nil
	}
	return ErrRedirectOrigin
}

// SameOrigin compares the scheme, hostname and effective port of HTTP URLs.
func SameOrigin(a, b *url.URL) bool {
	return (a.Scheme == "http" || a.Scheme == "https") && a.Scheme == b.Scheme &&
		a.Hostname() != "" && strings.EqualFold(a.Hostname(), b.Hostname()) && redirectPort(a) == redirectPort(b)
}

func redirectPort(u *url.URL) string {
	if port := u.Port(); port != "" {
		return port
	}
	if u.Scheme == "https" {
		return "443"
	}
	return "80"
}
