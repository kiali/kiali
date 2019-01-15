package handlers

import (
	"net/http"
	"strings"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

type AuthInfo struct {
	Strategy              string `json:"strategy"`
	AuthorizationEndpoint string `json:"authorizationEndpoint,omitempty"`
}

func AuthenticationHandler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		statusCode := http.StatusOK
		conf := config.Get()

		switch conf.Auth.Strategy {
		case "openshift":
			business, err := business.Get()

			if err != nil {
				log.Warning("Could not get business layer: ", err)
				statusCode = http.StatusUnauthorized
			} else {
				err := business.OpenshiftOAuth.ValidateToken(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))

				if err != nil {
					log.Warning("Token error: ", err)
					statusCode = http.StatusUnauthorized
				}
			}
		case "login":
			if strings.Contains(r.Header.Get("Authorization"), "Bearer") {
				err := config.ValidateToken(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))

				if err != nil {
					log.Warning("Token error: ", err)
					statusCode = http.StatusUnauthorized
				}
			} else {
				u, p, ok := r.BasicAuth()
				if !ok || conf.Server.Credentials.Username != u || conf.Server.Credentials.Password != p {
					statusCode = http.StatusUnauthorized
				}
			}
		case "anonymous":
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

func AuthenticationInfo(w http.ResponseWriter, r *http.Request) {
	var response AuthInfo

	conf := config.Get()

	response.Strategy = conf.Auth.Strategy

	switch conf.Auth.Strategy {
	case "openshift":
		business, err := business.Get()

		if err != nil {
			RespondWithJSONIndent(w, http.StatusInternalServerError, "Error trying to get business layer")
			return
		}

		metadata, err := business.OpenshiftOAuth.Metadata()

		if err != nil {
			RespondWithJSONIndent(w, http.StatusInternalServerError, "Error trying to get OAuth metadata")
			return
		}

		response.AuthorizationEndpoint = metadata.AuthorizationEndpoint
	}

	RespondWithJSON(w, http.StatusOK, response)
}
