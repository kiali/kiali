package authentication

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-jose/go-jose/jwt"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util"
)

// tokenAuthController contains the backing logic to implement
// Kiali's "token" authentication strategy. It assumes that the
// user will use a token that is valid to be used against the Cluster API.
// In it's simplest form, it can be a ServiceAccount token. However, it can
// be any kind of token that can be passed using HTTP Bearer authentication
// in requests to the Kubernetes API.
type tokenAuthController struct {
	conf          *config.Config
	kialiCache    cache.KialiCache
	clientFactory kubernetes.ClientFactory
	// SessionStore persists the session between HTTP requests.
	SessionStore SessionPersistor
}

type tokenSessionPayload struct {
	// Token is the string that the user entered in the Kiali login screen. It should be
	// a token that can be used against the Kubernetes API
	Token string `json:"token,omitempty"`
}

// NewTokenAuthController initializes a new controller for handling token authentication, with the
// given persistor and the given businessInstantiator. The businessInstantiator can be nil and
// the initialized contoller will use the business.Get function.
func NewTokenAuthController(persistor SessionPersistor, clientFactory kubernetes.ClientFactory, kialiCache cache.KialiCache, conf *config.Config) *tokenAuthController {
	return &tokenAuthController{
		clientFactory: clientFactory,
		SessionStore:  persistor,
		kialiCache:    kialiCache,
		conf:          conf,
	}
}

// Authenticate handles an HTTP request that contains a token passed in the "token" field of form data of
// the body of the request (POST, PATCH or PUT methods). The token should be valid to be used in the
// Kubernetes API, thus the token is verified by trying a request to the Kubernetes API.
// If the Kubernetes API rejects the token, authentication fails with an invalid/expired token error. If
// the token is accepted, privileges to read some namespace is checked. If some namespace is readable,
// authentication succeeds and a session is started; else, authentication is rejected because the
// user won't be able to see any data in Kiali.
// An AuthenticationFailureError is returned if the authentication request is rejected (unauthorized). Any
// other kind of error means that something unexpected happened.
func (c tokenAuthController) Authenticate(r *http.Request, w http.ResponseWriter) (*UserSessionData, error) {
	// Get the token from HTTP form data
	err := r.ParseForm()
	if err != nil {
		return nil, fmt.Errorf("error parsing form data from client: %w", err)
	}

	token := r.PostForm.Get("token")
	if token == "" {
		return nil, errors.New("token is empty")
	}

	// Need client factory to create a client for the namespace service
	// Create a bs layer with the received token to check its validity.
	clients, err := c.clientFactory.GetClients(&api.AuthInfo{Token: token})
	if err != nil {
		return nil, fmt.Errorf("could not get the clients: %w", err)
	}

	namespaceService := business.NewNamespaceService(clients, c.clientFactory.GetSAClients(), c.kialiCache, c.conf)

	// Using the namespaces API to check if token is valid. In Kubernetes, the version API seems to allow
	// anonymous access, so it's not feasible to use the version API for token verification.
	nsList, err := namespaceService.GetNamespaces(r.Context())
	if err != nil {
		c.SessionStore.TerminateSession(r, w)
		return nil, &AuthenticationFailureError{Reason: "token is not valid or is expired", Detail: err}
	}

	// If namespace list is empty, return authentication failure.
	if len(nsList) == 0 {
		c.SessionStore.TerminateSession(r, w)
		return nil, &AuthenticationFailureError{Reason: "not enough privileges to login"}
	}

	// Token was valid against the Kubernetes API, and it has privileges to read some namespace.
	// Accept the token. Create the user session.
	timeExpire := util.Clock.Now().Add(time.Second * time.Duration(config.Get().LoginToken.ExpirationSeconds))
	err = c.SessionStore.CreateSession(r, w, config.AuthStrategyToken, timeExpire, tokenSessionPayload{Token: token})
	if err != nil {
		return nil, err
	}

	return &UserSessionData{
		ExpiresOn: timeExpire,
		Username:  extractSubjectFromK8sToken(token),
		AuthInfo:  &api.AuthInfo{Token: token},
	}, nil
}

// ValidateSession restores a session previously created by the Authenticate function. A minimal re-validation
// is done: only token validity is re-checked by making a request to the Kubernetes API, like in the Authenticate
// function. However, privileges are not re-checked.
// If the session is still valid, a populated UserSessionData is returned. Otherwise, nil is returned.
func (c tokenAuthController) ValidateSession(r *http.Request, w http.ResponseWriter) (*UserSessionData, error) {
	// Restore a previously started session.
	sPayload := tokenSessionPayload{}
	sData, err := c.SessionStore.ReadSession(r, w, &sPayload)
	if err != nil {
		log.Warningf("Could not read the session: %v", err)
		return nil, err
	}
	if sData == nil {
		return nil, nil
	}

	// Check token validity.
	clients, err := c.clientFactory.GetClients(&api.AuthInfo{Token: sPayload.Token})
	if err != nil {
		return nil, fmt.Errorf("could create user clients from token: %w", err)
	}

	namespaceService := business.NewNamespaceService(clients, c.clientFactory.GetSAClients(), c.kialiCache, c.conf)
	_, err = namespaceService.GetNamespaces(r.Context())
	if err != nil {
		// The Kubernetes API rejected the token.
		// Return no data (which means no active session).
		log.Warningf("Token error!!: %v", err)
		return nil, nil
	}

	// If we are here, the session looks valid. Return the session details.
	r.Header.Add("Kiali-User", extractSubjectFromK8sToken(sPayload.Token)) // Internal header used to propagate the subject of the request for audit purposes
	return &UserSessionData{
		ExpiresOn: sData.ExpiresOn,
		Username:  extractSubjectFromK8sToken(sPayload.Token),
		AuthInfo:  &api.AuthInfo{Token: sPayload.Token},
	}, nil
}

// TerminateSession unconditionally terminates any existing session without any validation.
func (c tokenAuthController) TerminateSession(r *http.Request, w http.ResponseWriter) error {
	c.SessionStore.TerminateSession(r, w)
	return nil
}

// extractSubjectFromK8sToken returns the string stored in the "sub" claim of a JWT.
// If the sub claim is prefixed with the "system:serviceaccount:" this prefix is removed.
// If the token is not a JWT, or if it does not have a "sub" claim, a generic "token" string
// is returned.
func extractSubjectFromK8sToken(token string) string {
	subject := "token" // Set a default value

	// Decode the Kubernetes token (it is a JWT token) without validating its signature
	var claims map[string]interface{} // generic map to store parsed token
	parsedJWSToken, err := jwt.ParseSigned(token)
	if err == nil {
		err = parsedJWSToken.UnsafeClaimsWithoutVerification(&claims)
		if err == nil {
			subject = strings.TrimPrefix(claims["sub"].(string), "system:serviceaccount:") // Shorten the subject displayed in UI.
		}
	}

	return subject
}
