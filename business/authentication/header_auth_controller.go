package authentication

import (
	"net/http"
	"strings"
	"time"

	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util"
)

type headerAuthController struct {
	// businessInstantiator is a function that returns an already initialized
	// business layer. Normally, it should be set to the business.Get function.
	// For tests, it can be set to something else that returns a compatible API.
	businessInstantiator func(authInfo *api.AuthInfo) (*business.Layer, error)

	// SessionStore persists the session between HTTP requests.
	SessionStore SessionPersistor
}

type headerSessionPayload struct {
	Subject string `json:"subject,omitempty"`

	// Token is the (TODO)
	Token string `json:"token,omitempty"`
}

func NewHeaderAuthController(persistor SessionPersistor, businessInstantiator func(authInfo *api.AuthInfo) (*business.Layer, error)) *headerAuthController {
	if businessInstantiator == nil {
		businessInstantiator = business.Get
	}

	return &headerAuthController{
		businessInstantiator: businessInstantiator,
		SessionStore:         persistor,
	}
}

func (c headerAuthController) Authenticate(r *http.Request, w http.ResponseWriter) (*UserSessionData, error) {
	authInfo := c.getTokenStringFromHeader(r)

	if authInfo == nil || authInfo.Token == "" {
		c.SessionStore.TerminateSession(r, w)
		return nil, &AuthenticationFailureError{
			HttpStatus: http.StatusUnauthorized,
			Reason:     "Token is missing",
		}
	}

	kialiToken, err := kubernetes.GetKialiToken()

	if err != nil {
		return nil, err
	}

	bs, err := c.businessInstantiator(&api.AuthInfo{Token: kialiToken})
	if err != nil {
		return nil, &AuthenticationFailureError{
			Detail:     err,
			HttpStatus: http.StatusInternalServerError,
			Reason:     "Error instantiating the business layer",
		}
	}

	// Get the subject for the token to validate it as a valid token
	subjectFromToken, err := bs.TokenReview.GetTokenSubject(authInfo)

	if err != nil {
		return nil, err
	}

	// The token has been validated via k8s TokenReview, extract the subject for the ui to display
	// from either the subject (via the TokenReview) or the impersonation header
	var tokenSubject string

	if authInfo.Impersonate == "" {
		tokenSubject = subjectFromToken
		tokenSubject = strings.TrimPrefix(tokenSubject, "system:serviceaccount:") // Shorten the subject displayed in UI.
	} else {
		tokenSubject = authInfo.Impersonate
	}

	// Create the session
	timeExpire := util.Clock.Now().Add(time.Second * time.Duration(config.Get().LoginToken.ExpirationSeconds))
	err = c.SessionStore.CreateSession(r, w, config.AuthStrategyHeader, timeExpire, headerSessionPayload{Token: authInfo.Token, Subject: tokenSubject})
	if err != nil {
		return nil, err
	}

	return &UserSessionData{
		ExpiresOn: timeExpire,
		Username:  tokenSubject,
		Token:     authInfo.Token,
	}, nil
}

func (c headerAuthController) ValidateSession(r *http.Request, w http.ResponseWriter) (*UserSessionData, *api.AuthInfo, error) {
	log.Tracef("Using header for authentication, Url: [%s]", r.URL.String())

	sPayload := headerSessionPayload{}
	sData, err := c.SessionStore.ReadSession(r, w, sPayload)
	if err != nil {
		log.Warningf("Could not read the session: %v", err)
		return nil, nil, err
	}
	if sData == nil {
		return nil, nil, nil
	}

	authInfo := c.getTokenStringFromHeader(r)
	if authInfo.Token != sPayload.Token {
		log.Warningf("Rejecting user session because token in HTTP headers is not the same as the one in the session.")
		return nil, nil, nil
	}

	return &UserSessionData{
		ExpiresOn: sData.ExpiresOn,
		Username:  sPayload.Subject,
		Token:     sPayload.Token,
	}, authInfo, nil
}

// TerminateSession unconditionally terminates any existing session without any validation.
func (c headerAuthController) TerminateSession(r *http.Request, w http.ResponseWriter) {
	c.SessionStore.TerminateSession(r, w)
}

func (c headerAuthController) getTokenStringFromHeader(r *http.Request) *api.AuthInfo {
	tokenString := "" // Default to no token.

	// Extract token from the Authorization HTTP header sent from the reverse proxy
	if headerValue := r.Header.Get("Authorization"); strings.Contains(headerValue, "Bearer") {
		tokenString = strings.TrimPrefix(headerValue, "Bearer ")
	}

	authInfo := &api.AuthInfo{Token: tokenString}

	impersonationHeader := r.Header.Get("Impersonate-User")
	if len(impersonationHeader) > 0 {
		//there's an impersonation header, lets make sure to add it
		authInfo.Impersonate = impersonationHeader

		//Check for impersonated groups
		if groupsImpersonationHeader := r.Header["Impersonate-Group"]; len(groupsImpersonationHeader) > 0 {
			authInfo.ImpersonateGroups = groupsImpersonationHeader
		}

		//check for extra fields
		for headerName, headerValues := range r.Header {
			if strings.HasPrefix(headerName, "Impersonate-Extra-") {
				extraName := headerName[len("Impersonate-Extra-"):]
				if authInfo.ImpersonateUserExtra == nil {
					authInfo.ImpersonateUserExtra = make(map[string][]string)
				}
				authInfo.ImpersonateUserExtra[extraName] = headerValues
			}
		}
	}

	return authInfo
}
