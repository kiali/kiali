package authentication

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"gopkg.in/square/go-jose.v2/jwt"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util"
)

type AuthController interface {
	Authenticate(r *http.Request, w http.ResponseWriter) bool
	ValidateSession(r *http.Request, w http.ResponseWriter) (int, string)
	TerminateSession(r *http.Request, w http.ResponseWriter)
}

type TokenAuthController struct {
	SessionStore SessionPersistor
}

type sessionPayload struct {
	Token string `json:"token,omitempty"`
}

// TokenResponse tokenResponse
//
// This is used for returning the token
//
// swagger:model TokenResponse
type TokenResponse struct {
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

	// The authentication token
	// A string with the authentication token for the user
	//
	// example: zI1NiIsIsR5cCI6IkpXVCJ9.ezJ1c2VybmFtZSI6ImFkbWluIiwiZXhwIjoxNTI5NTIzNjU0fQ.PPZvRGnR6VA4v7FmgSfQcGQr-VD
	// required: true
	Token string
}

type AuthenticationFailureError struct {
	Reason string
	Detail error
}

func (e *AuthenticationFailureError) Error() string {
	if e.Detail != nil {
		return fmt.Sprintf("%s: %v", e.Reason, e.Detail)
	}

	return e.Reason
}

func (c TokenAuthController) Authenticate(r *http.Request, w http.ResponseWriter) (*TokenResponse, error) {
	err := r.ParseForm()

	if err != nil {
		return nil, fmt.Errorf("error parsing form data from client: %w", err)
		//handlers.RespondWithDetailedError(w, http.StatusInternalServerError, "Error parsing form data from client", err.Error())
	}

	token := r.Form.Get("token")

	if token == "" {
		return nil, errors.New("token is empty")
		//handlers.RespondWithError(w, http.StatusInternalServerError, "Token is empty.")
		//return false
	}

	business, err := business.Get(&api.AuthInfo{Token: token})
	if err != nil {
		return nil, fmt.Errorf("error instantiating the business layer: %w", err)
		//handlers.RespondWithDetailedError(w, http.StatusInternalServerError, "Error instantiating the business layer", err.Error())
		//return false
	}

	// Using the namespaces API to check if token is valid. In Kubernetes, the version API seems to allow
	// anonymous access, so it's not feasible to use the version API for token verification.
	nsList, err := business.Namespace.GetNamespaces()
	if err != nil {
		c.SessionStore.TerminateSession(r, w)
		return nil, &AuthenticationFailureError{Reason: "token is not valid or is expired", Detail: err}
		//handlers.RespondWithDetailedError(w, http.StatusUnauthorized, "Token is not valid or is expired", err.Error())
		//return false
	}

	// If namespace list is empty, return unauthorized error
	if len(nsList) == 0 {
		c.SessionStore.TerminateSession(r, w)
		return nil, &AuthenticationFailureError{Reason: "not enough privileges to login"}
		//handlers.RespondWithError(w, http.StatusUnauthorized, "Not enough privileges to login")
		//return false
	}

	// Now that we know that the ServiceAccount token is valid, parse/decode it to extract
	// the name of the service account. The "subject" is passed to the front-end to be displayed.
	tokenSubject := extractSubjectFromK8sToken(token)

	// Create the user session
	timeExpire := util.Clock.Now().Add(time.Second * time.Duration(config.Get().LoginToken.ExpirationSeconds))
	err = c.SessionStore.CreateSession(r, w, "token", timeExpire, sessionPayload{Token: token})

	//tokenClaims := config.IanaClaims{
	//	SessionId: token,
	//	StandardClaims: jwt.StandardClaims{
	//		Subject:   tokenSubject,
	//		ExpiresAt: timeExpire.Unix(),
	//		Issuer:    config.AuthStrategyTokenIssuer,
	//	},
	//}
	//tokenString, err := config.GetSignedTokenString(tokenClaims)
	if err != nil {
		return nil, err
		//handlers.RespondWithError(w, http.StatusInternalServerError, err.Error())
		//return false
	}

	//tokenCookie := http.Cookie{
	//	Name:     config.TokenCookieName,
	//	Value:    tokenString,
	//	Expires:  timeExpire,
	//	HttpOnly: true,
	//	Path:     config.Get().Server.WebRoot,
	//	SameSite: http.SameSiteStrictMode,
	//}
	//http.SetCookie(w, &tokenCookie)

	//handlers.RespondWithJSONIndent(w, http.StatusOK, TokenResponse{ExpiresOn: timeExpire.Format(time.RFC1123Z), Username: tokenSubject})
	return &TokenResponse{ExpiresOn: timeExpire, Username: tokenSubject, Token: token}, nil
}

func (c TokenAuthController) ValidateSession(r *http.Request, w http.ResponseWriter) (*TokenResponse, error) {
	sPayload := sessionPayload{}
	sData, err := c.SessionStore.ReadSession(r, w, &sPayload)
	if err != nil {
		log.Warningf("Could not read the session: %v", err)
		return nil, nil
	}
	if sData == nil {
		return nil, nil
	}

	business, err := business.Get(&api.AuthInfo{Token: sPayload.Token})
	if err != nil {
		//log.Warningf("Could not get the business layer!!!: %v", err)
		return nil, fmt.Errorf("could not get the business layer: %w", err)
		//return http.StatusInternalServerError, ""
	}

	_, err = business.Namespace.GetNamespaces()
	if err == nil {
		// Internal header used to propagate the subject of the request for audit purposes
		r.Header.Add("Kiali-User", extractSubjectFromK8sToken(sPayload.Token))
		return &TokenResponse{ExpiresOn: sData.ExpiresOn, Username: extractSubjectFromK8sToken(sPayload.Token), Token: sPayload.Token}, nil
		//return http.StatusOK, sPayload.token
	}

	log.Warningf("Token error!!: %v", err)

	//tokenString := getTokenStringFromRequest(r)
	//if claims, err := config.GetTokenClaimsIfValid(tokenString); err != nil {
	//	log.Warningf("Token is invalid!!!: %v", err)
	//} else {
	//	// Session ID claim must be present
	//	if len(claims.SessionId) == 0 {
	//		log.Warning("Token is invalid: sid claim is required")
	//		return http.StatusUnauthorized, ""
	//	}
	//
	//	business, err := business.Get(&api.AuthInfo{Token: claims.SessionId})
	//	if err != nil {
	//		log.Warningf("Could not get the business layer!!!: %v", err)
	//		return http.StatusInternalServerError, ""
	//	}
	//
	//	_, err = business.Namespace.GetNamespaces()
	//	if err == nil {
	//		// Internal header used to propagate the subject of the request for audit purposes
	//		r.Header.Add("Kiali-User", claims.Subject)
	//		return http.StatusOK, claims.SessionId
	//	}
	//
	//	log.Warningf("Token error!!: %v", err)
	//}

	return nil, nil
}

func (c TokenAuthController) TerminateSession(r *http.Request, w http.ResponseWriter) {
	c.SessionStore.TerminateSession(r, w)
}

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
