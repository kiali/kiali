package authentication

import (
	"fmt"
	"net/http"
	"time"

	"k8s.io/client-go/tools/clientcmd/api"
)

// TerminateSessionError is a helper type implementing the error interface.
// Its main goal is to pass the right HTTP status code that should be sent
// to the client if a session Logout operation fails.
type TerminateSessionError struct {
	// A description of the error.
	Message string

	// The HTTP Status code that should be sent to the client.
	HttpStatus int
}

// Error returns the string representation of an instance of TerminateSessionError.
func (e TerminateSessionError) Error() string {
	return e.Message
}

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

	// ValidateSession restores a session previously created by the Authenticate function. The validity of
	// the restored should be verified as much as possible by the implementing controllers.
	// If the session is still valid, a populated UserSessionData is returned. Otherwise, nil is returned.
	ValidateSession(r *http.Request, w http.ResponseWriter) (*UserSessionData, error)

	// TerminateSession performs the needed procedures to terminate an existing session. If there is no
	// active session, nothing is performed. If there is some invalid session, it is cleared.
	TerminateSession(r *http.Request, w http.ResponseWriter) error
}

// UserSessionData userSessionData
// This is used for returning the token
// swagger:model UserSessionData
type UserSessionData struct {
	// The expired time for the token
	// A string with the Datetime when the token will be expired
	//
	// example: Thu, 07 Mar 2019 17:50:26 +0000
	// required: true
	ExpiresOn time.Time `json:"expiresOn"`

	// The username for the token
	// A string with the user's username
	//
	// example: admin
	// required: true
	Username string `json:"username"`

	// The authentication information of the user to access the cluster API
	// It is usually only a bearer token that can be used to connect to the cluster API.
	// However, it is possible to add more options, like impersonation attributes.
	//
	// required: true
	AuthInfo *api.AuthInfo `json:"-"`
}

// AuthenticationFailureError is a helper Error to assist callers of the TokenAuthController.Authenticate
// function in distinguishing between authentication failures and
// unexpected errors.
type AuthenticationFailureError struct {
	// Wraps the error causing the authentication failure
	Detail error

	// The status code that should have the HTTP response for this error.
	HttpStatus int

	// A description of the authentication failure
	Reason string
}

// Error returns the string representation of an AuthenticationFailureError
func (e *AuthenticationFailureError) Error() string {
	if e.Detail != nil {
		return fmt.Sprintf("%s: %v", e.Reason, e.Detail)
	}

	return e.Reason
}
