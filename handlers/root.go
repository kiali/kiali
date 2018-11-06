package handlers

import (
	"net/http"
	"strings"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/status"
)

func Root(w http.ResponseWriter, r *http.Request) {
	getStatus(w, r)
}

func getStatus(w http.ResponseWriter, r *http.Request) {
	RespondWithJSONIndent(w, http.StatusOK, status.Get())
}

func GetToken(w http.ResponseWriter, r *http.Request) {
	token := r.Header.Get("X-Forwarded-Access-Token")

	if r.Header.Get("Gap-Signature") != "" {
		username := strings.Split(r.Header.Get("Gap-Auth"), "@")[0]

		if username == "" {
			RespondWithJSONIndent(w, http.StatusInternalServerError, username)
			return
		}

		expiresAt := time.Now().Add(time.Second * time.Duration(config.Get().LoginToken.ExpirationSeconds))
		token := config.TokenGenerated{Username: username, Token: token, ExpiredAt: expiresAt.String()}

		RespondWithJSONIndent(w, http.StatusOK, token)
	} else {
		u, _, ok := r.BasicAuth()

		if !ok {
			RespondWithJSONIndent(w, http.StatusInternalServerError, u)
			return
		}

		token, error := config.GenerateToken(u)
		if error != nil {
			RespondWithJSONIndent(w, http.StatusInternalServerError, error)
			return
		}
		RespondWithJSONIndent(w, http.StatusOK, token)
	}
}
