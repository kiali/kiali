package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

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
	Username  string `json:"username"`
	Token     string `json:"token"`
	ExpiresOn string `json:"expiresOn"`
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

	token := r.Form.Get("access_token")
	expiresIn := r.Form.Get("expires_in")

	expiresInNumber, err := strconv.Atoi(expiresIn)

	if token == "" || expiresIn == "" || err != nil {
		RespondWithJSONIndent(w, http.StatusInternalServerError, "Token is empty or invalid.")
		return
	}

	expiresOn := time.Now().Add(time.Second * time.Duration(expiresInNumber)).String()

	business, err := business.Get()
        if err != nil {
		RespondWithJSONIndent(w, http.StatusInternalServerError, "Error retrieving the OAuth package.");
        }

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
		Username:  user.Metadata.Name,
		Token:     token,
		ExpiresOn: expiresOn,
	})
}
