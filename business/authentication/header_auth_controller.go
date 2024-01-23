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

// headerAuthController contains the backing logic to implement
// Kiali's "header" authentication strategy. It assumes that authentication
// is fully done by an external system and Kiali does not participate. Kiali
// receives already valid credentials through HTTP headers on each request.
// Because of this, only minimal validation of the received credentials is
// performed.
type headerAuthController struct {
	// businessInstantiator is a function that returns an already initialized
	// business layer. Normally, it should be set to the business.Get function.
	// For tests, it can be set to something else that returns a compatible API.
	businessInstantiator func(authInfo *api.AuthInfo) (*business.Layer, error)

	// SessionStore persists the session between HTTP requests.
	SessionStore SessionPersistor
}

// headerSessionPayload is a helper type used as session data storage. An instance
// of this type is used with the SessionPersistor for session creation and persistence.
type headerSessionPayload struct {
	// The resolved username associated with the received credentials.
	Subject string `json:"subject,omitempty"`

	// Token is the Bearer token that the upstream client sent on the HTTP Authorization
	// header at the initial authentication.
	Token string `json:"token,omitempty"`
}

// NewHeaderAuthController initializes a new controller for allowing already authenticated requests, with the
// given persistor and the given businessInstantiator. The businessInstantiator can be nil and
// the initialized controller will use the business.Get function.
func NewHeaderAuthController(persistor SessionPersistor, businessInstantiator func(authInfo *api.AuthInfo) (*business.Layer, error)) *headerAuthController {
	if businessInstantiator == nil {
		businessInstantiator = business.Get
	}

	return &headerAuthController{
		businessInstantiator: businessInstantiator,
		SessionStore:         persistor,
	}
}

// Authenticate handles an HTTP request that contains credentials passed in HTTP headers.
// It is assumed that some external system is fully controlling authentication. Thus, it is
// assumed that the received credentials should be valid. Nevertheless, a minimal verification
// is done by trying to fetch the account/user name from the cluster. If account/user name information
// cannot be fetched, authentication is rejected.
// An error is returned if the authentication failed.
func (c headerAuthController) Authenticate(r *http.Request, w http.ResponseWriter) (*UserSessionData, error) {
	authInfo := c.getTokenStringFromHeader(r)

	if authInfo == nil || authInfo.Token == "" {
		c.SessionStore.TerminateSession(r, w)
		return nil, &AuthenticationFailureError{
			HttpStatus: http.StatusUnauthorized,
			Reason:     "Token is missing",
		}
	}

	kialiToken, _, err := kubernetes.GetKialiTokenForHomeCluster()
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
		AuthInfo:  authInfo,
	}, nil
}

// ValidateSession checks if credentials are available in HTTP headers. If they are present, a populated
// UserSessionData is returned. Otherwise, nil is returned.
func (c headerAuthController) ValidateSession(r *http.Request, w http.ResponseWriter) (*UserSessionData, error) {
	log.Tracef("Using header for authentication, Url: [%s]", r.URL.String())

	sPayload := headerSessionPayload{}
	sData, err := c.SessionStore.ReadSession(r, w, &sPayload)
	if err != nil {
		log.Warningf("Could not read the session: %v", err)
		return nil, err
	}

	authInfo := c.getTokenStringFromHeader(r)
	if authInfo == nil || authInfo.Token == "" {
		// No token in HTTP headers, means no session.
		return nil, nil
	}

	// A token in HTTP headers means there is a valid session, even if our cookies have
	// expired. So, if we have cookies, we can recover the subject. Else, send empty subject.
	// Expiration time is probably irrelevant for this auth strategy, but to keep the so-so same behavior
	// before the auth refactor, we set expiration time to "now" if we don't have cookies.
	var expiration time.Time
	var subject string
	if sData == nil {
		expiration = util.Clock.Now()
		subject = ""
	} else {
		expiration = sData.ExpiresOn
		subject = sPayload.Subject
	}

	return &UserSessionData{
		ExpiresOn: expiration,
		Username:  subject,
		AuthInfo:  authInfo,
	}, nil
}

// TerminateSession unconditionally terminates any existing session without any validation.
func (c headerAuthController) TerminateSession(r *http.Request, w http.ResponseWriter) error {
	c.SessionStore.TerminateSession(r, w)
	return nil
}

// getTokenStringFromHeader builds a Kubernetes api.AuthInfo object that contains user credentials
// and any other credential attributes received through HTTP headers. Minimally, the standard HTTP
// Authorization header is required to be present in the request containing a Bearer token that
// can be used to make requests to the cluster API. Additionally, Kubernetes Impersonation
// headers are allowed. Since all these headers are going to be used against the cluster API, here
// we read passively the data and let the cluster do its own validations on the credentials.
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
