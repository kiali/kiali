package authentication

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

type openshiftSessionPayload struct {
	Token string `json:"token,omitempty"`
}

type OpenshiftAuthController struct {
	// businessInstantiator is a function that returns an already initialized
	// business layer. Normally, it should be set to the business.Get function.
	// For tests, it can be set to something else that returns a compatible API.
	businessInstantiator func(authInfo *api.AuthInfo) (*business.Layer, error)

	// SessionStore persists the session between HTTP requests.
	SessionStore SessionPersistor
}

// NewOpenshiftAuthController initializes a new controller for handling OpenShift authentication, with the
// given persistor and the given businessInstantiator. The businessInstantiator can be nil and
// the initialized contoller will use the business.Get function.
func NewOpenshiftAuthController(persistor SessionPersistor, businessInstantiator func(authInfo *api.AuthInfo) (*business.Layer, error)) *OpenshiftAuthController {
	if businessInstantiator == nil {
		businessInstantiator = business.Get
	}

	return &OpenshiftAuthController{
		businessInstantiator: businessInstantiator,
		SessionStore:         persistor,
	}
}

func (o OpenshiftAuthController) Authenticate(r *http.Request, w http.ResponseWriter) (*UserSessionData, error) {
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
	bs, err := o.businessInstantiator(&api.AuthInfo{Token: ""})
	if err != nil {
		return nil, fmt.Errorf("error retrieving the OAuth package (getting business layer): %w", err)
	}

	user, err := bs.OpenshiftOAuth.GetUserInfo(token)
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
		Token:     token,
	}, nil
}

func (o OpenshiftAuthController) ValidateSession(r *http.Request, w http.ResponseWriter) (*UserSessionData, error) {
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

	bs, err := o.businessInstantiator(&api.AuthInfo{Token: sPayload.Token})
	if err != nil {
		log.Warningf("Could not get the business layer!: %v", err)
		return nil, fmt.Errorf("could not get the business layer: %w", err)
	}

	user, err := bs.OpenshiftOAuth.GetUserInfo(sPayload.Token)
	if err == nil {
		// Internal header used to propagate the subject of the request for audit purposes
		r.Header.Add("Kiali-User", user.Metadata.Name)
		return &UserSessionData{
			ExpiresOn: sData.ExpiresOn,
			Username:  user.Metadata.Name,
			Token:     sPayload.Token,
		}, nil
	}

	log.Warningf("Token error: %v", err)
	return nil, nil
}

func (o OpenshiftAuthController) TerminateSession(r *http.Request, w http.ResponseWriter) error {
	sPayload := openshiftSessionPayload{}
	sData, err := o.SessionStore.ReadSession(r, w, &sPayload)
	if err != nil {
		return TerminateSessionError{
			Message:    fmt.Sprintf("Apparently, there is no active openshift session: %v", err),
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

	bs, err := o.businessInstantiator(&api.AuthInfo{Token: sPayload.Token})
	if err != nil {
		return TerminateSessionError{
			Message:    fmt.Sprintf("Could not get the business layer: %v", err),
			HttpStatus: http.StatusInternalServerError,
		}
	}

	err = bs.OpenshiftOAuth.Logout(sPayload.Token)
	if err != nil {
		return TerminateSessionError{
			Message:    fmt.Sprintf("Could not log out of OpenShift: %v", err),
			HttpStatus: http.StatusInternalServerError,
		}
	}

	o.SessionStore.TerminateSession(r, w)
	return nil
}
