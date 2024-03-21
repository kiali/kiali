package authentication

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util"
)

// openshiftSessionPayload holds the data that will be persisted in the SessionStore
// in order to be able to maintain the session of the user across requests.
type openshiftSessionPayload struct {
	// Token is the access_token that was provided by the OpenShift OAuth server.
	// It can be used against the cluster API.
	Token string `json:"token,omitempty"`
}

// openshiftAuthController contains the backing logic to implement
// Kiali's "openshift" authentication strategy. This authentication
// strategy is basically an implementation of OAuth's implicit flow
// with the specifics of OpenShift.
//
// Alternatively, it is possible that 3rd-parties are controlling
// the session. For these cases, Kiali can receive an OpenShift token
// via the "Authorization" HTTP Header or via the "oauth_token"
// URL parameter. Token received from 3rd parties are not persisted
// with the active Kiali's persistor, because that would collide and
// replace an existing Kiali session. So, it is assumed that the 3rd-party
// has its own persistence system (similarly to how 'header' auth works).
type openshiftAuthController struct {
	openshiftOAuth *business.OpenshiftOAuthService
	// SessionStore persists the session between HTTP requests.
	SessionStore SessionPersistor
}

// NewOpenshiftAuthController initializes a new controller for handling OpenShift authentication, with the
// given persistor and the given businessInstantiator. The businessInstantiator can be nil and
// the initialized contoller will use the business.Get function.
func NewOpenshiftAuthController(persistor SessionPersistor, openshiftOAuth *business.OpenshiftOAuthService) *openshiftAuthController {
	return &openshiftAuthController{
		openshiftOAuth: openshiftOAuth,
		SessionStore:   persistor,
	}
}

// Authenticate handles an HTTP request that contains the access_token, expires_in URL parameters. The access_token
// should be the token that was obtained from the OpenShift OAuth server and expires_in is the expiration date-time
// of the token. The token is validated by obtaining the information user tied to it. Although RBAC is always assumed
// when using OpenShift, privileges are not checked here.
func (o openshiftAuthController) Authenticate(r *http.Request, w http.ResponseWriter) (*UserSessionData, error) {
	err := r.ParseForm()
	if err != nil {
		return nil, fmt.Errorf("error parsing form info: %w", err)
	}

	token := r.Form.Get("access_token")
	expiresIn := r.Form.Get("expires_in")
	if token == "" || expiresIn == "" {
		return nil, errors.New("token is empty or invalid")
	}

	expiresInNumber, err := strconv.Atoi(expiresIn)
	if err != nil {
		return nil, fmt.Errorf("token is empty or invalid: %w", err)
	}

	expiresOn := time.Now().Add(time.Second * time.Duration(expiresInNumber))

	user, err := o.openshiftOAuth.GetUserInfo(token)
	if err != nil {
		o.SessionStore.TerminateSession(r, w)
		return nil, &AuthenticationFailureError{
			Reason:     "Token is not valid or is expired.",
			Detail:     err,
			HttpStatus: http.StatusUnauthorized,
		}
	}

	err = o.SessionStore.CreateSession(r, w, config.AuthStrategyOpenshift, expiresOn, openshiftSessionPayload{Token: token})
	if err != nil {
		return nil, err
	}

	return &UserSessionData{
		ExpiresOn: expiresOn,
		Username:  user.Metadata.Name,
		AuthInfo:  &api.AuthInfo{Token: token},
	}, nil
}

// ValidateSession restores a session previously created by the Authenticate function. The user token (access_token)
// is revalidated by re-fetching user info from the cluster, to ensure that the token hasn't been revoked.
// If the session is still valid, a populated UserSessionData is returned. Otherwise, nil is returned.
func (o openshiftAuthController) ValidateSession(r *http.Request, w http.ResponseWriter) (*UserSessionData, error) {
	var token string
	var expires time.Time

	// In OpenShift auth, it is possible that a session is started by a 3rd party. If that's the case, Kiali
	// can receive the OpenShift token of the session via HTTP Headers of via a URL Query string parameter.
	// HTTP Headers have priority over URL parameters. If a token is received via some of these means,
	// then the received session has priority over the Kiali initiated session (stored in cookies).
	if authHeader := r.Header.Get("Authorization"); len(authHeader) != 0 && strings.HasPrefix(authHeader, "Bearer ") {
		token = strings.TrimPrefix(authHeader, "Bearer ")
		expires = util.Clock.Now().Add(time.Second * time.Duration(config.Get().LoginToken.ExpirationSeconds))
	} else if authToken := r.URL.Query().Get("oauth_token"); len(authToken) != 0 {
		token = strings.TrimSpace(authToken)
		expires = util.Clock.Now().Add(time.Second * time.Duration(config.Get().LoginToken.ExpirationSeconds))
	} else {
		sPayload := openshiftSessionPayload{}
		sData, err := o.SessionStore.ReadSession(r, w, &sPayload)
		if err != nil {
			log.Warningf("Could not read the openshift session: %v", err)
			return nil, nil
		}
		if sData == nil {
			return nil, nil
		}

		// The Openshift token must be present
		if len(sPayload.Token) == 0 {
			log.Warning("Session is invalid: the Openshift token is absent")
			return nil, nil
		}

		token = sPayload.Token
		expires = sData.ExpiresOn
	}

	user, err := o.openshiftOAuth.GetUserInfo(token)
	if err == nil {
		// Internal header used to propagate the subject of the request for audit purposes
		r.Header.Add("Kiali-User", user.Metadata.Name)
		return &UserSessionData{
			ExpiresOn: expires,
			Username:  user.Metadata.Name,
			AuthInfo:  &api.AuthInfo{Token: token},
		}, nil
	}

	log.Warningf("Token error: %v", err)
	return nil, nil
}

// TerminateSession session created by the Authenticate function.
// To properly clean the session, the OpenShift access_token is revoked/deleted by making a call
// to the relevant OpenShift API. If this process fails, the session is not cleared and an error
// is returned.
// The cleanup is done assuming the access_token was issued to be used only in Kiali.
func (o openshiftAuthController) TerminateSession(r *http.Request, w http.ResponseWriter) error {
	sPayload := openshiftSessionPayload{}
	sData, err := o.SessionStore.ReadSession(r, w, &sPayload)
	if err != nil {
		return TerminateSessionError{
			Message:    fmt.Sprintf("There is no active openshift session: %v", err),
			HttpStatus: http.StatusUnauthorized,
		}
	}
	if sData == nil {
		return TerminateSessionError{
			Message:    "logout problem: no session exists.",
			HttpStatus: http.StatusInternalServerError,
		}
	}

	// The Openshift token must be present
	if len(sPayload.Token) == 0 {
		return TerminateSessionError{
			Message:    "Cannot logout: the Openshift token is absent from the session",
			HttpStatus: http.StatusInternalServerError,
		}
	}

	err = o.openshiftOAuth.Logout(sPayload.Token)
	if err != nil {
		return TerminateSessionError{
			Message:    fmt.Sprintf("Could not log out of OpenShift: %v", err),
			HttpStatus: http.StatusInternalServerError,
		}
	}

	o.SessionStore.TerminateSession(r, w)
	return nil
}
