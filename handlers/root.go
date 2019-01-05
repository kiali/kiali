package handlers

import (
	"net/http"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/status"
)

type TokenResponse struct {
	Username  string `json:"username"`
	Token     string `json:"token"`
	ExpiresOn string `json:"expiresOn"`
}

func Root(w http.ResponseWriter, r *http.Request) {
	getStatus(w, r)
}

func getStatus(w http.ResponseWriter, r *http.Request) {
	RespondWithJSONIndent(w, http.StatusOK, status.Get())
}

func GetToken(w http.ResponseWriter, r *http.Request) {
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

	RespondWithJSONIndent(w, http.StatusOK, TokenResponse{Token: token.Token, ExpiresOn: token.ExpiresOn, Username: u})
}
