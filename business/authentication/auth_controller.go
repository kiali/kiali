package authentication

import (
	"net/http"

	"github.com/kiali/kiali/config"
)

type AuthController interface {
	Authenticate(r *http.Request, w http.ResponseWriter) (*UserSessionData, error)
	ValidateSession(r *http.Request, w http.ResponseWriter) (*UserSessionData, error)
	TerminateSession(r *http.Request, w http.ResponseWriter)
}

var authController AuthController

func GetAuthController() AuthController {
	return authController
}

func InitializeAuthenticationController(strategy string) {
	persistor := CookieSessionPersistor{}

	if strategy == config.AuthStrategyToken {
		authController = &TokenAuthController{SessionStore: persistor}
	}
}
