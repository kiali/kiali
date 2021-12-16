package authentication

import (
	"k8s.io/client-go/tools/clientcmd/api"
	"net/http"
	"strings"
	"time"

	"gopkg.in/square/go-jose.v2/jwt"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util"
)

type AuthController interface {
	Authenticate(w http.ResponseWriter, r *http.Request) bool
	ValidateSession(w http.ResponseWriter, r *http.Request) (int, string)
}

type TokenAuthController struct {
	sessionStore SessionPersistor
}

type sessionPayload struct {
	token string `json:"token,omitempty"`
}

func (c TokenAuthController) Authenticate(w http.ResponseWriter, r *http.Request) bool {
	err := r.ParseForm()

	if err != nil {
		RespondWithDetailedError(w, http.StatusInternalServerError, "Error parsing form data from client", err.Error())
		return false
	}

	token := r.Form.Get("token")

	if token == "" {
		RespondWithError(w, http.StatusInternalServerError, "Token is empty.")
		return false
	}

	business, err := business.Get(&api.AuthInfo{Token: token})
	if err != nil {
		RespondWithDetailedError(w, http.StatusInternalServerError, "Error instantiating the business layer", err.Error())
		return false
	}

	// Using the namespaces API to check if token is valid. In Kubernetes, the version API seems to allow
	// anonymous access, so it's not feasible to use the version API for token verification.
	nsList, err := business.Namespace.GetNamespaces()
	if err != nil {
		c.sessionStore.TerminateSession(w, r)
		RespondWithDetailedError(w, http.StatusUnauthorized, "Token is not valid or is expired", err.Error())
		return false
	}

	// If namespace list is empty, return unauthorized error
	if len(nsList) == 0 {
		c.sessionStore.TerminateSession(w, r)
		RespondWithError(w, http.StatusUnauthorized, "Not enough privileges to login")
		return false
	}

	// Now that we know that the ServiceAccount token is valid, parse/decode it to extract
	// the name of the service account. The "subject" is passed to the front-end to be displayed.
	tokenSubject := extractSubjectFromK8sToken(token)

	// Create the user session
	timeExpire := util.Clock.Now().Add(time.Second * time.Duration(config.Get().LoginToken.ExpirationSeconds))
	err = c.sessionStore.CreateSession(r, w, "token", timeExpire, sessionPayload{token: token})

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
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return false
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

	RespondWithJSONIndent(w, http.StatusOK, TokenResponse{Token: tokenString, ExpiresOn: timeExpire.Format(time.RFC1123Z), Username: tokenSubject})
	return true
}

func (c TokenAuthController) ValidateSession(w http.ResponseWriter, r *http.Request) (int, string) {
	payload, err := c.sessionStore.ReadSession(r, w)
	sPayload := payload.(sessionPayload)

	business, err := business.Get(&api.AuthInfo{Token: sPayload.token})
	if err != nil {
		log.Warningf("Could not get the business layer!!!: %v", err)
		return http.StatusInternalServerError, ""
	}

	_, err = business.Namespace.GetNamespaces()
	if err == nil {
		// Internal header used to propagate the subject of the request for audit purposes
		r.Header.Add("Kiali-User", extractSubjectFromK8sToken(sPayload.token))
		return http.StatusOK, sPayload.token
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

	return http.StatusUnauthorized, ""
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
