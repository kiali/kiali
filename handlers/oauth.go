package handlers

import (
	"fmt"
	"net/http"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
)

type OpenshiftUserMetadata struct {
	Name string `json:"name"`
}

type OpenshiftUser struct {
	Metadata OpenshiftUserMetadata `json:"metadata"`
}

type UserResponse struct {
	ExpiresIn string `json:"expiresIn"`
	Token     string `json:"token"`
	Username  string `json:"username"`
}

// Checks if the token is working correctly.
// This endpoint is more strict than the one on business/openshift_oauth.go
// because it is not going to be requested as often, so we can request some
// more fine-grained permissions.
func OauthCheck(w http.ResponseWriter, r *http.Request) {
	if config.Get().Auth.Strategy != "openshift" {
		RespondWithJSONIndent(w, http.StatusInternalServerError, "Openshift OAuth is not enabled for this deployment")
		return
	}

	err := r.ParseForm()

	if err != nil {
		RespondWithJSONIndent(w, http.StatusInternalServerError, fmt.Errorf("Error parsing form info: %+v", err))
		return
	}

	token := r.Form.Get("accessToken")
	expiresIn := r.Form.Get("expiresIn")

	if token == "" || expiresIn == "" {
		RespondWithJSONIndent(w, http.StatusInternalServerError, "Token is empty.")
		return
	}

	business, err := business.Get()
	err = business.OpenshiftOAuth.ValidateToken(token)

	if err != nil {
		RespondWithJSONIndent(w, http.StatusUnauthorized, "Token is not valid or is expired.")
		return
	}

	user, err := business.OpenshiftOAuth.GetUserInfo(token)

	if err != nil {
		RespondWithJSONIndent(w, http.StatusUnauthorized, "Token is not valid or is expired.")
		return
	}

	RespondWithJSONIndent(w, http.StatusOK, UserResponse{
		ExpiresIn: expiresIn,
		Token:     token,
		Username:  user.Metadata.Name,
	})
}
