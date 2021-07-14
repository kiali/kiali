package handlers

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/dgrijalva/jwt-go"
	"k8s.io/apimachinery/pkg/util/uuid"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util"
	"github.com/kiali/kiali/util/httputil"
)

type AuthenticationHandler struct {
	saToken string
}

type AuthInfo struct {
	Strategy              string      `json:"strategy"`
	AuthorizationEndpoint string      `json:"authorizationEndpoint,omitempty"`
	LogoutEndpoint        string      `json:"logoutEndpoint,omitempty"`
	LogoutRedirect        string      `json:"logoutRedirect,omitempty"`
	SessionInfo           sessionInfo `json:"sessionInfo"`
	SecretMissing         bool        `json:"secretMissing,omitempty"`
}

type sessionInfo struct {
	Username  string `json:"username,omitempty"`
	ExpiresOn string `json:"expiresOn,omitempty"`
}

// TokenResponse tokenResponse
//
// This is used for returning the token
//
// swagger:model TokenResponse
type TokenResponse struct {
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
	Token string `json:"token"`
	// The expired time for the token
	// A string with the Datetime when the token will be expired
	//
	// example: Thu, 07 Mar 2019 17:50:26 +0000
	// required: true
	ExpiresOn string `json:"expiresOn"`
}

// Acknowledgement to rinat.io user of SO.
// Taken from https://stackoverflow.com/a/48479355 with a few modifications
func chunkString(s string, chunkSize int) []string {
	if len(s) <= chunkSize {
		return []string{s}
	}

	numChunks := len(s)/chunkSize + 1
	chunks := make([]string, 0, numChunks)
	runes := []rune(s)

	for i := 0; i < len(runes); i += chunkSize {
		nn := i + chunkSize
		if nn > len(runes) {
			nn = len(runes)
		}
		chunks = append(chunks, string(runes[i:nn]))
	}
	return chunks
}

func getTokenStringFromRequest(r *http.Request) string {
	tokenString := "" // Default to no token.

	// Token can be provided by a browser in a Cookie or
	// in an authorization HTTP header.
	// The token in the cookie has priority.
	if authCookie, err := r.Cookie(config.TokenCookieName); err != http.ErrNoCookie {
		tokenString = authCookie.Value
	} else if headerValue := r.Header.Get("Authorization"); strings.Contains(headerValue, "Bearer") {
		tokenString = strings.TrimPrefix(headerValue, "Bearer ")
	}

	return tokenString
}

func getTokenStringFromHeader(r *http.Request) *api.AuthInfo {
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

func performOpenshiftAuthentication(w http.ResponseWriter, r *http.Request) bool {
	err := r.ParseForm()

	if err != nil {
		RespondWithJSONIndent(w, http.StatusInternalServerError, fmt.Errorf("error parsing form info: %+v", err))
		return false
	}

	token := r.Form.Get("access_token")
	expiresIn := r.Form.Get("expires_in")
	if token == "" || expiresIn == "" {
		RespondWithError(w, http.StatusInternalServerError, "Token is empty or invalid.")
		return false
	}

	expiresInNumber, err := strconv.Atoi(expiresIn)
	if err != nil {
		RespondWithDetailedError(w, http.StatusInternalServerError, "Token is empty or invalid.", err.Error())
		return false
	}

	expiresOn := time.Now().Add(time.Second * time.Duration(expiresInNumber))

	business, err := getBusiness(r)
	if err != nil {
		RespondWithDetailedError(w, http.StatusInternalServerError, "Error retrieving the OAuth package (getting business layer).", err.Error())
		return false
	}

	user, err := business.OpenshiftOAuth.GetUserInfo(token)
	if err != nil {
		deleteTokenCookies(w, r)
		RespondWithDetailedError(w, http.StatusUnauthorized, "Token is not valid or is expired.", err.Error())
		return false
	}

	tokenClaims := config.IanaClaims{
		SessionId: token,
		StandardClaims: jwt.StandardClaims{
			Subject:   user.Metadata.Name,
			ExpiresAt: expiresOn.Unix(),
			Issuer:    config.AuthStrategyOpenshiftIssuer,
		},
	}
	tokenString, err := config.GetSignedTokenString(tokenClaims)
	if err != nil {
		RespondWithJSONIndent(w, http.StatusInternalServerError, err)
		return false
	}

	tokenCookie := http.Cookie{
		Name:     config.TokenCookieName,
		Value:    tokenString,
		Expires:  expiresOn,
		HttpOnly: true,
		Path:     config.Get().Server.WebRoot,
		SameSite: http.SameSiteStrictMode,
	}
	http.SetCookie(w, &tokenCookie)

	RespondWithJSONIndent(w, http.StatusOK, TokenResponse{Token: tokenString, ExpiresOn: expiresOn.Format(time.RFC1123Z), Username: user.Metadata.Name})
	return true
}

func performOpenIdAuthentication(w http.ResponseWriter, r *http.Request) bool {
	conf := config.Get()

	// Read received HTTP params and check for data completeness
	openIdParams, err := business.ExtractOpenIdCallbackParams(r)
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, err.Error())
		return false
	}

	business.CallbackCleanup(w)

	if checkFailure := business.CheckOpenIdImplicitFlowParams(openIdParams); len(checkFailure) != 0 {
		RespondWithError(w, http.StatusBadRequest, checkFailure)
		return false
	}

	// CSRF mitigation
	if stateError := business.ValidateOpenIdState(openIdParams); len(stateError) > 0 {
		RespondWithError(w, http.StatusForbidden, fmt.Sprintf("Request rejected: %s", stateError))
		return false
	}

	// Parse the received id_token from the IdP and check nonce code
	if err := business.ParseOpenIdToken(openIdParams); err != nil {
		deleteTokenCookies(w, r)
		RespondWithError(w, http.StatusUnauthorized, err.Error())
		return false
	}
	if nonceError := business.ValidateOpenIdNonceCode(openIdParams); len(nonceError) > 0 {
		RespondWithError(w, http.StatusForbidden, fmt.Sprintf("OpenId token rejected: %s", nonceError))
		return false
	}

	if conf.Auth.OpenId.DisableRBAC {
		// When RBAC is on, we delegate some validations to the Kubernetes cluster. However, if RBAC is off
		// the token must be fully validated, as we no longer pass the OpenId token to the cluster API server.
		// Since the configuration indicates RBAC is off, we do the validations:
		err = business.ValidateOpenTokenInHouse(openIdParams)
		if err != nil {
			RespondWithDetailedError(w, http.StatusForbidden, "the OpenID token was rejected", err.Error())
			return true
		}
	} else {
		// Check if user trying to login has enough privileges to login. This check is only done if
		// config indicates that RBAC is on. For cases where RBAC is off, we simply assume that the
		// Kiali ServiceAccount token should have enough privileges and skip this privilege check.
		httpStatus, errMsg, detailedError := business.VerifyOpenIdUserAccess(openIdParams.IdToken)
		if detailedError != nil {
			RespondWithDetailedError(w, httpStatus, errMsg, detailedError.Error())
			return false
		} else if httpStatus != http.StatusOK {
			RespondWithError(w, httpStatus, errMsg)
			return false
		}
	}

	// Now that we know that the OpenId token is valid, build our session cookie
	// and send it to the browser.
	tokenClaims := business.BuildOpenIdJwtClaims(openIdParams, false)
	tokenString, err := config.GetSignedTokenString(tokenClaims)
	if err != nil {
		RespondWithJSONIndent(w, http.StatusInternalServerError, err)
		return false
	}

	tokenCookie := http.Cookie{
		Name:     config.TokenCookieName,
		Value:    tokenString,
		Expires:  openIdParams.ExpiresOn,
		HttpOnly: true,
		Path:     conf.Server.WebRoot,
		SameSite: http.SameSiteStrictMode,
	}
	http.SetCookie(w, &tokenCookie)

	RespondWithJSONIndent(w, http.StatusOK, TokenResponse{Token: tokenString, ExpiresOn: openIdParams.ExpiresOn.Format(time.RFC1123Z), Username: openIdParams.Subject})
	return true
}

func performHeaderAuthentication(w http.ResponseWriter, r *http.Request) bool {
	authInfo := getTokenStringFromHeader(r)

	if authInfo == nil || authInfo.Token == "" {
		deleteTokenCookies(w, r)
		RespondWithError(w, http.StatusUnauthorized, "Token is missing")
		return false
	}

	kialiToken, err := kubernetes.GetKialiToken()

	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return false
	}

	business, err := business.Get(&api.AuthInfo{Token: kialiToken})
	if err != nil {
		RespondWithDetailedError(w, http.StatusInternalServerError, "Error instantiating the business layer", err.Error())
		return false
	}

	// Get the subject for the token to validate it as a valid token
	subjectFromToken, err := business.TokenReview.GetTokenSubject(authInfo)

	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return false
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

	// Build the Kiali token
	timeExpire := util.Clock.Now().Add(time.Second * time.Duration(config.Get().LoginToken.ExpirationSeconds))
	tokenClaims := config.IanaClaims{
		SessionId: string(uuid.NewUUID()),
		StandardClaims: jwt.StandardClaims{
			Subject:   tokenSubject,
			ExpiresAt: timeExpire.Unix(),
			Issuer:    config.AuthStrategyHeaderIssuer,
		},
	}
	tokenString, err := config.GetSignedTokenString(tokenClaims)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return false
	}

	tokenCookie := http.Cookie{
		Name:     config.TokenCookieName,
		Value:    tokenString,
		Expires:  timeExpire,
		HttpOnly: true,
		Path:     config.Get().Server.WebRoot,
		SameSite: http.SameSiteStrictMode,
	}
	http.SetCookie(w, &tokenCookie)

	RespondWithJSONIndent(w, http.StatusOK, TokenResponse{Token: tokenString, ExpiresOn: timeExpire.Format(time.RFC1123Z), Username: tokenSubject})
	return true

}

func performTokenAuthentication(w http.ResponseWriter, r *http.Request) bool {
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
		deleteTokenCookies(w, r)
		RespondWithDetailedError(w, http.StatusUnauthorized, "Token is not valid or is expired", err.Error())
		return false
	}

	// If namespace list is empty, return unauthorized error
	if len(nsList) == 0 {
		deleteTokenCookies(w, r)
		RespondWithError(w, http.StatusUnauthorized, "Not enough privileges to login")
		return false
	}

	// Now that we know that the ServiceAccount token is valid, parse/decode it to extract
	// the name of the service account. The "subject" is passed to the front-end to be displayed.
	tokenSubject := "token" // Set a default value

	parsedClusterToken, _, err := new(jwt.Parser).ParseUnverified(token, &jwt.StandardClaims{})
	if err == nil {
		tokenSubject = parsedClusterToken.Claims.(*jwt.StandardClaims).Subject
		tokenSubject = strings.TrimPrefix(tokenSubject, "system:serviceaccount:") // Shorten the subject displayed in UI.
	}

	// Build the Kiali token
	timeExpire := util.Clock.Now().Add(time.Second * time.Duration(config.Get().LoginToken.ExpirationSeconds))
	tokenClaims := config.IanaClaims{
		SessionId: token,
		StandardClaims: jwt.StandardClaims{
			Subject:   tokenSubject,
			ExpiresAt: timeExpire.Unix(),
			Issuer:    config.AuthStrategyTokenIssuer,
		},
	}
	tokenString, err := config.GetSignedTokenString(tokenClaims)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return false
	}

	tokenCookie := http.Cookie{
		Name:     config.TokenCookieName,
		Value:    tokenString,
		Expires:  timeExpire,
		HttpOnly: true,
		Path:     config.Get().Server.WebRoot,
		SameSite: http.SameSiteStrictMode,
	}
	http.SetCookie(w, &tokenCookie)

	RespondWithJSONIndent(w, http.StatusOK, TokenResponse{Token: tokenString, ExpiresOn: timeExpire.Format(time.RFC1123Z), Username: tokenSubject})
	return true
}

func performOpenshiftLogout(r *http.Request) (int, error) {
	tokenString := getTokenStringFromRequest(r)
	if tokenString == "" {
		// No token on logout, so we assume we're already logged out
		return http.StatusUnauthorized, errors.New("Already logged out")
	}
	if claims, err := config.GetTokenClaimsIfValid(tokenString); err != nil {
		log.Warningf("Token is invalid: %v", err)
		return http.StatusInternalServerError, err
	} else {
		business, err := business.Get(&api.AuthInfo{Token: claims.SessionId})
		if err != nil {
			log.Warningf("Could not get the business layer: %v", err)
			return http.StatusInternalServerError, err
		}

		err = business.OpenshiftOAuth.Logout(claims.SessionId)
		if err != nil {
			log.Warningf("Could not log out of OpenShift: %v", err)
			return http.StatusInternalServerError, err
		}

		return http.StatusNoContent, nil
	}
}

func checkOpenshiftSession(w http.ResponseWriter, r *http.Request) (int, string) {
	tokenString := getTokenStringFromRequest(r)
	if claims, err := config.GetTokenClaimsIfValid(tokenString); err != nil {
		log.Warningf("Token is invalid! : %v", err)
	} else {
		// Session ID claim must be present
		if len(claims.SessionId) == 0 {
			log.Warning("Token is invalid: sid claim is required")
			return http.StatusUnauthorized, ""
		}

		business, err := business.Get(&api.AuthInfo{Token: claims.SessionId})
		if err != nil {
			log.Warningf("Could not get the business layer!: %v", err)
			return http.StatusInternalServerError, ""
		}

		_, err = business.OpenshiftOAuth.GetUserInfo(claims.SessionId)
		if err == nil {
			// Internal header used to propagate the subject of the request for audit purposes
			r.Header.Add("Kiali-User", claims.Subject)
			return http.StatusOK, claims.SessionId
		}

		log.Warningf("Token error: %v", err)
	}

	return http.StatusUnauthorized, ""
}

func checkOpenIdSession(w http.ResponseWriter, r *http.Request) (int, string) {
	// First, check presence of a session for the "implicit flow"
	var claims *config.IanaClaims

	tokenString := getTokenStringFromRequest(r)
	if len(tokenString) != 0 {
		var err error
		if claims, err = config.GetTokenClaimsIfValid(tokenString); err != nil {
			log.Warningf("Token is invalid!!: %v", err)
			return http.StatusUnauthorized, ""
		}
	} else {
		// If not present, check presence of a session for the "authorization code" flow
		var err error
		claims, err = business.GetOpenIdAesSession(r)
		if err != nil {
			log.Warningf("There was an error when decoding the session: %v", err)
			return http.StatusUnauthorized, ""
		}
		if claims == nil {
			log.Warning("User seems to not be logged in")
			return http.StatusUnauthorized, ""
		}
	}

	// Session ID claim must be present
	if len(claims.SessionId) == 0 {
		log.Warning("Token is invalid: sid claim is required")
		return http.StatusUnauthorized, ""
	}

	business, err := business.Get(&api.AuthInfo{Token: claims.SessionId})
	if err != nil {
		log.Warningf("Could not get the business layer!!: %v", err)
		return http.StatusInternalServerError, ""
	}

	conf := config.Get()

	// If the id_token is being used to make calls to the cluster API, it's known that
	// this token is a JWT and some of its structure; so, it's possible to do some sanity
	// checks on the token. However, if the access_token is being used, this token is opaque
	// and these sanity checks must be skipped.
	if conf.Auth.OpenId.ApiToken != "access_token" {
		// Parse the sid claim (id_token) to check that the sub claim matches to the configured "username" claim of the id_token
		parsedIdToken, _, err := new(jwt.Parser).ParseUnverified(claims.SessionId, jwt.MapClaims{})
		if err != nil {
			log.Warningf("Cannot parse sid claim of the Kiali token!: %v", err)
			return http.StatusInternalServerError, ""
		}
		if userClaim, ok := parsedIdToken.Claims.(jwt.MapClaims)[config.Get().Auth.OpenId.UsernameClaim]; ok && claims.Subject != userClaim {
			log.Warning("Kiali token rejected because of subject claim mismatch")
			return http.StatusUnauthorized, ""
		}
	}

	if !conf.Auth.OpenId.DisableRBAC {
		// If RBAC is ENABLED, check that the user has privilges on the cluster.
		_, err = business.Namespace.GetNamespaces()
		if err != nil {
			log.Warningf("Token error!: %v", err)
			return http.StatusUnauthorized, ""
		}
	}

	// Internal header used to propagate the subject of the request for audit purposes
	r.Header.Add("Kiali-User", claims.Subject)
	return http.StatusOK, claims.SessionId
}

func checkTokenSession(w http.ResponseWriter, r *http.Request) (int, string) {
	tokenString := getTokenStringFromRequest(r)
	if claims, err := config.GetTokenClaimsIfValid(tokenString); err != nil {
		log.Warningf("Token is invalid!!!: %v", err)
	} else {
		// Session ID claim must be present
		if len(claims.SessionId) == 0 {
			log.Warning("Token is invalid: sid claim is required")
			return http.StatusUnauthorized, ""
		}

		business, err := business.Get(&api.AuthInfo{Token: claims.SessionId})
		if err != nil {
			log.Warningf("Could not get the business layer!!!: %v", err)
			return http.StatusInternalServerError, ""
		}

		_, err = business.Namespace.GetNamespaces()
		if err == nil {
			// Internal header used to propagate the subject of the request for audit purposes
			r.Header.Add("Kiali-User", claims.Subject)
			return http.StatusOK, claims.SessionId
		}

		log.Warningf("Token error!!: %v", err)
	}

	return http.StatusUnauthorized, ""
}

func NewAuthenticationHandler() (AuthenticationHandler, error) {
	// Read token from the filesystem
	saToken, err := kubernetes.GetKialiToken()
	if err != nil {
		return AuthenticationHandler{}, err
	}
	return AuthenticationHandler{saToken: saToken}, nil
}

func (aHandler AuthenticationHandler) Handle(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		statusCode := http.StatusOK
		conf := config.Get()

		var authInfo *api.AuthInfo
		var token string

		switch conf.Auth.Strategy {
		case config.AuthStrategyOpenshift:
			statusCode, token = checkOpenshiftSession(w, r)
			authInfo = &api.AuthInfo{Token: token}
		case config.AuthStrategyOpenId:
			statusCode, token = checkOpenIdSession(w, r)
			if conf.Auth.OpenId.DisableRBAC {
				// If RBAC is off, it's assumed that the kubernetes cluster will reject the OpenId token.
				// Instead, we use the Kiali token an this has the side effect that all users will share the
				// same privileges.
				token = aHandler.saToken
			}

			authInfo = &api.AuthInfo{Token: token}
		case config.AuthStrategyToken:
			statusCode, token = checkTokenSession(w, r)
			authInfo = &api.AuthInfo{Token: token}
		case config.AuthStrategyAnonymous:
			log.Tracef("Access to the server endpoint is not secured with credentials - letting request come in. Url: [%s]", r.URL.String())
			token = aHandler.saToken
			authInfo = &api.AuthInfo{Token: token}
		case config.AuthStrategyHeader:
			log.Tracef("Using header for authentication, Url: [%s]", r.URL.String())
			authInfo = getTokenStringFromHeader(r)
			if authInfo == nil || authInfo.Token == "" {
				statusCode = http.StatusUnauthorized
			} else {
				statusCode = http.StatusOK
			}
		}

		switch statusCode {
		case http.StatusOK:
			if authInfo == nil {
				http.Error(w, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
				log.Errorf("No authInfo: %v", http.StatusBadRequest)
			}
			context := context.WithValue(r.Context(), "authInfo", authInfo)
			next.ServeHTTP(w, r.WithContext(context))
		case http.StatusUnauthorized:
			deleteTokenCookies(w, r)
			http.Error(w, http.StatusText(http.StatusUnauthorized), http.StatusUnauthorized)
		default:
			http.Error(w, http.StatusText(statusCode), statusCode)
			log.Errorf("Cannot send response to unauthorized user: %v", statusCode)
		}
	})
}

func (aHandler AuthenticationHandler) HandleUnauthenticated(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		context := context.WithValue(r.Context(), "authInfo", &api.AuthInfo{Token: ""})
		next.ServeHTTP(w, r.WithContext(context))
	})
}

func Authenticate(w http.ResponseWriter, r *http.Request) {
	conf := config.Get()
	switch conf.Auth.Strategy {
	case config.AuthStrategyOpenshift:
		performOpenshiftAuthentication(w, r)
	case config.AuthStrategyOpenId:
		performOpenIdAuthentication(w, r)
	case config.AuthStrategyToken:
		performTokenAuthentication(w, r)
	case config.AuthStrategyHeader:
		performHeaderAuthentication(w, r)
	case config.AuthStrategyAnonymous:
		log.Warning("Authentication attempt with anonymous access enabled.")
	default:
		message := fmt.Sprintf("Cannot authenticate users, because strategy <%s> is unknown.", conf.Auth.Strategy)
		log.Errorf(message)
		RespondWithError(w, http.StatusInternalServerError, message)
	}
}

func AuthenticationInfo(w http.ResponseWriter, r *http.Request) {
	var response AuthInfo

	conf := config.Get()

	response.Strategy = conf.Auth.Strategy

	switch conf.Auth.Strategy {
	case config.AuthStrategyOpenshift:
		business, err := getBusiness(r)
		if err != nil {
			RespondWithDetailedError(w, http.StatusInternalServerError, "Error authenticating (getting business layer)", err.Error())
			return
		}

		metadata, err := business.OpenshiftOAuth.Metadata()
		if err != nil {
			RespondWithDetailedError(w, http.StatusInternalServerError, "Error trying to get OAuth metadata", err.Error())
			return
		}

		response.AuthorizationEndpoint = metadata.AuthorizationEndpoint
		response.LogoutEndpoint = metadata.LogoutEndpoint
		response.LogoutRedirect = metadata.LogoutRedirect
	case config.AuthStrategyOpenId:
		// Do the redirection through an intermediary own endpoint
		response.AuthorizationEndpoint = fmt.Sprintf("%s/api/auth/openid_redirect",
			httputil.GuessKialiURL(r))
	}

	token := getTokenStringFromRequest(r)
	claims, _ := config.GetTokenClaimsIfValid(token)
	if claims == nil && conf.Auth.Strategy == config.AuthStrategyOpenId {
		var aes error
		claims, aes = business.GetOpenIdAesSession(r)
		if aes != nil {
			log.Warningf("Apparently, there is no AES session: %s ", aes.Error())
		}
	}

	if claims != nil {
		response.SessionInfo = sessionInfo{
			ExpiresOn: time.Unix(claims.ExpiresAt, 0).Format(time.RFC1123Z),
			Username:  claims.Subject,
		}
	}

	RespondWithJSON(w, http.StatusOK, response)
}

func Logout(w http.ResponseWriter, r *http.Request) {
	deleteTokenCookies(w, r)

	// We need to perform an extra step to invalidate the user token when using OpenShift OAuth
	conf := config.Get()
	if conf.Auth.Strategy == config.AuthStrategyOpenshift {
		code, err := performOpenshiftLogout(r)
		if err != nil {
			RespondWithError(w, code, err.Error())
		} else {
			RespondWithCode(w, code)
		}
	} else {
		RespondWithCode(w, http.StatusNoContent)
	}
}

func OpenIdRedirect(w http.ResponseWriter, r *http.Request) {
	conf := config.Get()

	// This endpoint should be available only when OpenId strategy
	if conf.Auth.Strategy != config.AuthStrategyOpenId {
		RespondWithError(w, http.StatusNotFound, "OpenId strategy is not enabled")
		return
	}

	// Build scopes string
	scopes := strings.Join(business.GetConfiguredOpenIdScopes(), " ")

	// Determine authorization endpoint
	authorizationEndpoint := conf.Auth.OpenId.AuthorizationEndpoint
	if len(authorizationEndpoint) == 0 {
		openIdMetadata, err := business.GetOpenIdMetadata()
		if err != nil {
			RespondWithDetailedError(w, http.StatusInternalServerError, "Error fetching OpenID provider metadata.", err.Error())
			return
		}
		authorizationEndpoint = openIdMetadata.AuthURL
	}

	// Create a "nonce" code and set a cookie with the code
	// It was chosen 15 chars arbitrarily. Probably, it's not worth to make this value configurable.
	nonceCode, err := util.CryptoRandomString(15)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Random number generator failed")
		return
	}

	nowTime := util.Clock.Now()
	expirationTime := nowTime.Add(time.Duration(conf.Auth.OpenId.AuthenticationTimeout) * time.Second)
	nonceCookie := http.Cookie{
		Expires:  expirationTime,
		HttpOnly: true,
		Name:     business.OpenIdNonceCookieName,
		Path:     conf.Server.WebRoot,
		SameSite: http.SameSiteLaxMode,
		Value:    nonceCode,
	}
	http.SetCookie(w, &nonceCookie)

	// Instead of sending the nonce code to the IdP, send a cryptographic hash.
	// This way, if an attacker manages to steal the id_token returned by the IdP, he still
	// needs to craft the cookie (which is hopefully very, very hard to do).
	nonceHash := sha256.Sum224([]byte(nonceCode))

	// OpenID spec recommends the use of "state" parameter. Although it's just a recommendation,
	// some identity providers have chosen to require the "state" parameter, effectively blocking
	// authentication with Kiali.
	// The state parameter is to mitigate CSRF attacks. Mitigation is usually done with
	// a token and it's implementation *could* be similar to the nonce code, but this would
	// require a second cookie.
	// To reduce the usage of cookies, let's use the already generated nonce as a session_id,
	// and the "nowTime" to generate a hash and use it as CSRF token. The Kiali's signing key is also used to
	// add a component that is not traveling over the network.
	// Although this "binds" the id_token returned by the IdP with the CSRF mitigation, this should be OK
	// because we are including a "secret" key (i.e. should an attacker steal the nonce code, he still needs to know
	// the Kiali's signing key).
	csrfHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", nonceCode, nowTime.UTC().Format("060102150405"), config.GetSigningKey())))

	// Use OpenId's "implicit flow" by default. Use "authorization code" flow if possible.
	responseType := "id_token"
	if business.IsOpenIdCodeFlowPossible() {
		responseType = "code"
	}

	// Send redirection to browser
	redirectUri := fmt.Sprintf("%s?client_id=%s&response_type=%s&redirect_uri=%s&scope=%s&nonce=%s&state=%s",
		authorizationEndpoint,
		url.QueryEscape(conf.Auth.OpenId.ClientId),
		responseType,
		url.QueryEscape(httputil.GuessKialiURL(r)),
		url.QueryEscape(scopes),
		url.QueryEscape(fmt.Sprintf("%x", nonceHash)),
		url.QueryEscape(fmt.Sprintf("%x-%s", csrfHash, nowTime.UTC().Format("060102150405"))),
	)

	if len(conf.Auth.OpenId.AdditionalRequestParams) > 0 {
		urlParams := make([]string, 0, len(conf.Auth.OpenId.AdditionalRequestParams))
		for k, v := range conf.Auth.OpenId.AdditionalRequestParams {
			urlParams = append(urlParams, fmt.Sprintf("%s=%s", url.QueryEscape(k), url.QueryEscape(v)))
		}
		redirectUri = fmt.Sprintf("%s&%s", redirectUri, strings.Join(urlParams, "&"))
	}

	http.Redirect(w, r, redirectUri, http.StatusFound)
}

func OpenIdCodeFlowHandler(w http.ResponseWriter, r *http.Request) bool {
	conf := config.Get()
	webRoot := conf.Server.WebRoot
	webRootWithSlash := webRoot + "/"

	// Read received HTTP params and check for data completeness
	openIdParams, err := business.ExtractOpenIdCallbackParams(r)
	if err != nil {
		log.Errorf("Error when reading URL parameters passed by the OpenID provider: %s", err.Error())
		http.Redirect(w, r, fmt.Sprintf("%s?openid_error=%s", webRootWithSlash, url.QueryEscape("Error when reading URL parameters passed by the OpenID provider")), http.StatusFound)
		return true // Return true to mark request as handled (because an error is already being sent back)
	}

	if checkFailure := business.CheckOpenIdAuthorizationCodeFlowParams(openIdParams); len(checkFailure) != 0 {
		log.Infof("Not handling OpenId code flow authentication: %s", checkFailure)
		return false
	}

	// Start handling the callback for OpenId authentication (code flow)
	business.CallbackCleanup(w)

	// CSRF mitigation
	if stateError := business.ValidateOpenIdState(openIdParams); len(stateError) > 0 {
		log.Errorf("OpenID authentication rejected: %s", stateError)
		http.Redirect(w, r, fmt.Sprintf("%s?openid_error=%s", webRootWithSlash, url.QueryEscape("Request rejected: invalid state")), http.StatusFound)
		return true
	}

	// Exchange the received code for a token
	if err := business.RequestOpenIdToken(openIdParams, httputil.GuessKialiURL(r)); err != nil {
		msg := fmt.Sprintf("Failure when retrieving user identity: %s", err.Error())
		log.Error(msg)
		http.Redirect(w, r, fmt.Sprintf("%s?openid_error=%s", webRootWithSlash, url.QueryEscape(msg)), http.StatusFound)
		return true
	}

	if err := business.ParseOpenIdToken(openIdParams); err != nil {
		deleteTokenCookies(w, r)
		log.Errorf("Error when parsing the OpenId token: %s", err.Error())
		http.Redirect(w, r, fmt.Sprintf("%s?openid_error=%s", webRootWithSlash, url.QueryEscape(err.Error())), http.StatusFound)
		return true
	}

	// Replay attack mitigation
	if nonceError := business.ValidateOpenIdNonceCode(openIdParams); len(nonceError) > 0 {
		msg := fmt.Sprintf("OpenId token rejected: %s", nonceError)
		log.Error(msg)
		http.Redirect(w, r, fmt.Sprintf("%s?openid_error=%s", webRootWithSlash, url.QueryEscape(msg)), http.StatusFound)
		return true
	}

	useAccessToken := false
	if conf.Auth.OpenId.DisableRBAC {
		// When RBAC is on, we delegate some validations to the Kubernetes cluster. However, if RBAC is off
		// the token must be fully validated, as we no longer pass the OpenId token to the cluster API server.
		// Since the configuration indicates RBAC is off, we do the validations:
		err = business.ValidateOpenTokenInHouse(openIdParams)
		if err != nil {
			msg := fmt.Sprintf("the OpenID token was rejected: %s", err.Error())
			log.Error(msg)
			http.Redirect(w, r, fmt.Sprintf("%s?openid_error=%s", webRootWithSlash, url.QueryEscape(msg)), http.StatusFound)
			return true
		}
	} else {
		// Check if user trying to login has enough privileges to login. This check is only done if
		// config indicates that RBAC is on. For cases where RBAC is off, we simply assume that the
		// Kiali ServiceAccount token should have enough privileges and skip this privilege check.
		apiToken := openIdParams.IdToken
		if conf.Auth.OpenId.ApiToken == "access_token" {
			apiToken = openIdParams.AccessToken
			useAccessToken = true
		}
		httpStatus, errMsg, detailedError := business.VerifyOpenIdUserAccess(apiToken)
		if detailedError != nil {
			msg := fmt.Sprintf("%s: %s", errMsg, detailedError.Error())
			log.Errorf("Error when verifying user privileges: %s", msg)
			http.Redirect(w, r, fmt.Sprintf("%s?openid_error=%s", webRootWithSlash, url.QueryEscape(msg)), http.StatusFound)
			return true
		} else if httpStatus != http.StatusOK {
			log.Errorf("Error when verifying user privileges: %s", errMsg)
			http.Redirect(w, r, fmt.Sprintf("%s?openid_error=%s", webRootWithSlash, url.QueryEscape(errMsg)), http.StatusFound)
			return true
		}
	}

	// Create Kiali's session cookie and set it in the response

	// For the OpenId's "authorization code" flow we don't want
	// any of the session data to be readable even in the browser's
	// developer console. So, we cipher the session data using AES-GCM
	// which allows to leave aside the usage of JWT tokens. So, this
	// builds a bare JSON serialized into a string, cipher it and
	// set a cookie with the ciphered string. Yet, we use the
	// "IanaClaims" type just for convenience to avoid creating new types and
	// to bring some type convergence on types for the auth source code.
	sessionData := business.BuildOpenIdJwtClaims(openIdParams, useAccessToken)
	sessionDataJson, err := json.Marshal(sessionData)
	if err != nil {
		msg := fmt.Sprintf("Error when creating credentials - failed to marshal json: %s", err.Error())
		log.Error(msg)
		http.Redirect(w, r, fmt.Sprintf("%s?openid_error=%s", webRootWithSlash, url.QueryEscape(msg)), http.StatusFound)
		return true
	}

	// Cipher the session data and encode to base64
	block, err := aes.NewCipher([]byte(config.GetSigningKey()))
	if err != nil {
		msg := fmt.Sprintf("Error when creating credentials - failed to create cipher: %s", err.Error())
		log.Error(msg)
		http.Redirect(w, r, fmt.Sprintf("%s?openid_error=%s", webRootWithSlash, url.QueryEscape(msg)), http.StatusFound)
		return true
	}

	aesGcm, err := cipher.NewGCM(block)
	if err != nil {
		msg := fmt.Sprintf("Error when creating credentials - failed to create gcm: %s", err.Error())
		log.Error(msg)
		http.Redirect(w, r, fmt.Sprintf("%s?openid_error=%s", webRootWithSlash, url.QueryEscape(msg)), http.StatusFound)
		return true
	}

	aesGcmNonce, err := util.CryptoRandomBytes(aesGcm.NonceSize())
	if err != nil {
		msg := fmt.Sprintf("Error when creating credentials - failed to generate random bytes: %s", err.Error())
		log.Error(msg)
		http.Redirect(w, r, fmt.Sprintf("%s?openid_error=%s", webRootWithSlash, url.QueryEscape(msg)), http.StatusFound)
		return true
	}

	cipherSessionData := aesGcm.Seal(aesGcmNonce, aesGcmNonce, sessionDataJson, nil)
	base64SessionData := base64.StdEncoding.EncodeToString(cipherSessionData)

	// If resulting session data is large, it may not fit in one cookie. So, the resulting
	// session data is broken in chunks and multiple cookies are used, as is needed.
	sessionDataChunks := chunkString(base64SessionData, business.SessionCookieMaxSize)
	for i, chunk := range sessionDataChunks {
		var cookieName string
		if i == 0 {
			// Set a cookie with the regular cookie name with the first chunk of session data.
			// This is for backwards compatibility
			cookieName = config.TokenCookieName + "-aes"
		} else {
			// If there are more chunks of session data (usually because of larger tokens from the IdP),
			// store the remainder data to numbered cookies.
			cookieName = fmt.Sprintf("%s-aes-%d", config.TokenCookieName, i)
		}

		authCookie := http.Cookie{
			Name:     cookieName,
			Value:    chunk,
			Expires:  openIdParams.ExpiresOn,
			HttpOnly: true,
			Path:     conf.Server.WebRoot,
			SameSite: http.SameSiteStrictMode,
		}
		http.SetCookie(w, &authCookie)
	}

	if len(sessionDataChunks) > 1 {
		// Set a cookie with the number of chunks of the session data.
		// This is to protect against reading spurious chunks of data if there is
		// any failure when killing the session or logging out.
		chunksCookie := http.Cookie{
			Name:     config.TokenCookieName + "-chunks",
			Value:    strconv.Itoa(len(sessionDataChunks)),
			Expires:  openIdParams.ExpiresOn,
			HttpOnly: true,
			Path:     conf.Server.WebRoot,
			SameSite: http.SameSiteStrictMode,
		}
		http.SetCookie(w, &chunksCookie)
	}

	// Let's redirect (remove the openid params) to let the Kiali-UI to boot
	http.Redirect(w, r, webRootWithSlash, http.StatusFound)

	return true
}

func deleteTokenCookies(w http.ResponseWriter, r *http.Request) {
	conf := config.Get()
	var cookiesToDrop []string

	numChunksCookie, chunksCookieErr := r.Cookie(config.TokenCookieName + "-chunks")
	if chunksCookieErr == nil {
		numChunks, convErr := strconv.Atoi(numChunksCookie.Value)
		if convErr == nil && numChunks > 1 && numChunks <= 180 {
			cookiesToDrop = make([]string, 0, numChunks+2)
			for i := 1; i < numChunks; i++ {
				cookiesToDrop = append(cookiesToDrop, fmt.Sprintf("%s-aes-%d", config.TokenCookieName, i))
			}
		} else {
			cookiesToDrop = make([]string, 0, 3)
		}
	} else {
		cookiesToDrop = make([]string, 0, 3)
	}

	cookiesToDrop = append(cookiesToDrop, config.TokenCookieName)
	cookiesToDrop = append(cookiesToDrop, config.TokenCookieName+"-aes")
	cookiesToDrop = append(cookiesToDrop, config.TokenCookieName+"-chunks")

	for _, cookieName := range cookiesToDrop {
		_, err := r.Cookie(cookieName)
		if err != http.ErrNoCookie {
			tokenCookie := http.Cookie{
				Name:     cookieName,
				Value:    "",
				Expires:  time.Unix(0, 0),
				HttpOnly: true,
				MaxAge:   -1,
				Path:     conf.Server.WebRoot,
				SameSite: http.SameSiteStrictMode,
			}
			http.SetCookie(w, &tokenCookie)
		}
	}
}
