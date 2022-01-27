package authentication

import (
	"net/http"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/config"
)

// AuthController is the interface that all Kiali authentication strategies should implement.
// An authentication controller is initialized during Kiali startup.
type AuthController interface {
	// Authenticate handles an HTTP request that contains credentials. The method to pass the credentials
	// is chosen by the authentication controller implementation. The credentials are verified and if
	// it is supported by the controller, RBAC permissions are verified to ensure that the logging in user
	// has enough privileges to login to Kiali.
	// An AuthenticationFailureError is returned if the authentication request is rejected (unauthorized). Any
	// other kind of error means that something unexpected happened.
	Authenticate(r *http.Request, w http.ResponseWriter) (*UserSessionData, error)

	// GetAuthCallbackHandler returns an http handler for authentication requests done to Kiali's web_root.
	// This handler should determine if the request is an authentication request and perform
	// authentication if needed. If it is not possible to reliably determine that a request is an
	// authentication request, the fallbackHandler should be invoked to further handle the request.
	//
	// Usually, authentication requests done to the Kiali's web_root are because of callbacks of
	// third-party authentication systems.
	//
	// This function can return a nil handler if the implementing AuthController does not handle
	// authentication requests through the Kiali's web_root.
	GetAuthCallbackHandler(fallbackHandler http.Handler) http.Handler

	// PostRoutes adds any additional endpoints needed on the Kiali's router
	// by the implementing AuthController.
	PostRoutes(router *mux.Router)

	// ValidateSession restores a session previously created by the Authenticate function. The validity of
	// the restored should be verified as much as possible by the implementing controllers.
	// If the session is still valid, a populated UserSessionData is returned. Otherwise, nil is returned.
	ValidateSession(r *http.Request, w http.ResponseWriter) (*UserSessionData, error)

	// TerminateSession performs the needed procedures to terminate an existing session. If there is no
	// active session, nothing is performed. If there is some invalid session, it is cleared.
	TerminateSession(r *http.Request, w http.ResponseWriter)
}

var authController AuthController

// GetAuthController gets the authentication controller that is currently configured and handling
// user sessions and any authentication related requests.
func GetAuthController() AuthController {
	return authController
}

// InitializeAuthenticationController initializes the authentication controller associated to the
// given strategy and prepares it to control user sessions and handle authentication requests.
// This should be called during Kiali startup, before starting to listen to HTTP requests.
func InitializeAuthenticationController(strategy string) {
	persistor := CookieSessionPersistor{}

	if strategy == config.AuthStrategyToken {
		authController = NewTokenAuthController(persistor, nil)
	} else if strategy == config.AuthStrategyOpenId {
		authController = NewOpenIdAuthController(persistor, nil)
	}
}
