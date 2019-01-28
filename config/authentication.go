package config

import (
	"net/http"
	"strings"

	"github.com/kiali/kiali/log"
)

func AuthenticationHandler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		statusCode := http.StatusOK
		errMsg := ""
		conf := Get()
		if strings.Contains(r.Header.Get("Authorization"), "Bearer") {
			err := ValidateToken(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
			if err != nil {
				log.Warning("Token error: ", err)
				statusCode = http.StatusUnauthorized
			}
		} else if conf.Server.Credentials.Username != "" || conf.Server.Credentials.Password != "" {
			u, p, ok := r.BasicAuth()
			if !ok || conf.Server.Credentials.Username != u || conf.Server.Credentials.Password != p {
				statusCode = http.StatusUnauthorized
			}
		} else if conf.Server.Credentials.Anonymous {
			log.Trace("Access to the server endpoint is not secured with credentials - letting request come in")
		} else {
			statusCode = 520 // our specific error code that indicates to the client that we are missing the secret
			errMsg = "Credentials are missing. Create a secret and restart Kiali. Please refer to the documentation for more details."
		}

		if statusCode != http.StatusOK && errMsg == "" {
			errMsg = http.StatusText(statusCode)
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
			http.Error(w, errMsg, statusCode)
		default:
			http.Error(w, errMsg, statusCode)
			log.Errorf("Cannot send response to unauthorized user: %v (%v)", statusCode, errMsg)
		}
	})
}
