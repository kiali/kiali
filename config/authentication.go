package config

import (
	"net/http"
	"strings"

	"github.com/kiali/kiali/log"
)

func AuthenticationHandler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		statusCode := http.StatusOK
		conf := Get()

		switch strategy := conf.AuthStrategy; strategy {
		case "openshift":
			// For openshift logins, we just need to make sure the header is
			// available. The token is generated and verified by the proxy.
			//
			// If it's not present, return 403.
			if r.Header.Get("X-Forwarded-Access-Token") == "" {
				statusCode = http.StatusUnauthorized
			} else {
				log.Trace("Access allowed via oauth strategy...")
			}
		case "login":
			/// For login, we check the authorization header, or force basic auth.
			if strings.Contains(r.Header.Get("Authorization"), "Bearer") {
				err := ValidateToken(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))

				if err != nil {
					log.Warning("Token error: ", err)
					statusCode = http.StatusUnauthorized
				}
			} else if conf.Server.Credentials.Username == "" || conf.Server.Credentials.Password == "" {
				// Blocks anonymous requests if the server has no defined credentials.
				// This is not the perfect solution, as it can cause some confusion on
				// malformed configurations, but is still better than to allow an
				// unknown user to access the data.
				statusCode = http.StatusUnauthorized
			} else {
				u, p, ok := r.BasicAuth()

				if !ok || conf.Server.Credentials.Username != u || conf.Server.Credentials.Password != p {
					statusCode = http.StatusUnauthorized
				}
			}
		case "none":
			// For none, we just bypass the auth entirely, allowing for anonymous
			// user. This is not recommended in production.
			log.Trace("Access to the server endpoint is not secured with credentials - letting request come in")
		}

		switch statusCode {
		case http.StatusOK:
			next.ServeHTTP(w, r)
		case http.StatusUnauthorized:
			// If header exists return the value, must be 1 to use the API from Kiali
			// Otherwise an empty string is returned and WWW-Authenticate will be Basic
			if r.Header.Get("X-Auth-Type-Kiali-UI") == "1" {
				w.Header().Set("WWW-Authenticate", "xBasic realm=\"Kiali\"")
			} else {
				w.Header().Set("WWW-Authenticate", "Basic realm=\"Kiali\"")
			}
			http.Error(w, http.StatusText(http.StatusUnauthorized), http.StatusUnauthorized)
		default:
			http.Error(w, http.StatusText(statusCode), statusCode)
			log.Errorf("Cannot send response to unauthorized user: %v", statusCode)
		}
	})
}
