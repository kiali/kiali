package handlers

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/dgrijalva/jwt-go"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/ldap"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util"
	"github.com/kiali/kiali/util/httputil"
)

const (
	missingSecretStatusCode = 520
	openIdNonceCookieName   = config.TokenCookieName + "-openid-nonce"
	defaultSessionDuration  = 3600
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

func checkKialiCredentials(r *http.Request) string {
	conf := config.Get()

	if conf.Server.Credentials.Username == "" || conf.Server.Credentials.Passphrase == "" {
		return ""
	}

	u, p, ok := r.BasicAuth()
	if ok && conf.Server.Credentials.Username == u && conf.Server.Credentials.Passphrase == p {
		return u
	}

	return ""
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

func performKialiAuthentication(w http.ResponseWriter, r *http.Request) bool {
	// Check if user is already logged in
	oldToken := getTokenStringFromRequest(r)
	user, err := config.ValidateToken(oldToken)
	if err != nil {
		log.Debugf("(Re-)authentication was asked. Validation of old token failed with: %v", err)
	}

	// If user is already logged in, skip credential
	// validation and just send a new JWT to extend
	// the session of the user.
	if len(user) == 0 {
		user = checkKialiCredentials(r)

		if len(user) == 0 {
			conf := config.Get()
			if conf.Server.Credentials.Username == "" && conf.Server.Credentials.Passphrase == "" {
				log.Error("Credentials are missing. Create a secret. Please refer to the documentation for more details.")
				RespondWithCode(w, missingSecretStatusCode) // our specific error code that indicates to the client that we are missing the secret
				return false
			} else {
				RespondWithCode(w, http.StatusUnauthorized)
				return false
			}
		}
	}

	token, err := config.GenerateToken(user)

	if err != nil {
		RespondWithJSONIndent(w, http.StatusInternalServerError, err)
		return false
	}

	tokenCookie := http.Cookie{
		Name:     config.TokenCookieName,
		Value:    token.Token,
		Expires:  token.ExpiresOn,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	}
	http.SetCookie(w, &tokenCookie)

	RespondWithJSONIndent(w, http.StatusOK, TokenResponse{Token: token.Token, ExpiresOn: token.ExpiresOn.Format(time.RFC1123Z), Username: user})
	return true
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
		SameSite: http.SameSiteStrictMode,
	}
	http.SetCookie(w, &tokenCookie)

	RespondWithJSONIndent(w, http.StatusOK, TokenResponse{Token: tokenString, ExpiresOn: expiresOn.Format(time.RFC1123Z), Username: user.Metadata.Name})
	return true
}

func performOpenIdAuthentication(w http.ResponseWriter, r *http.Request) bool {
	// Check if the nonce cookie is present
	nonceCookie, err := r.Cookie(openIdNonceCookieName)
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, "No nonce code present. Login window timed out.")
		return false
	}

	// Calculate the hash of the nonce code
	nonceHash := sha256.Sum224([]byte(nonceCookie.Value))

	// Delete the nonce cookie since we no longer need it.
	deleteNonceCookie := http.Cookie{
		Name:     openIdNonceCookieName,
		Expires:  time.Unix(0, 0),
		HttpOnly: true,
		Path:     config.Get().Server.WebRoot,
		SameSite: http.SameSiteStrictMode,
		Value:    "",
	}
	http.SetCookie(w, &deleteNonceCookie)

	// Parse/fetch received login parameters
	err = r.ParseForm()

	if err != nil {
		RespondWithJSONIndent(w, http.StatusBadRequest, fmt.Errorf("error parsing form info: %+v", err))
		return false
	}

	token := r.Form.Get("id_token")
	state := r.Form.Get("state")
	if token == "" {
		RespondWithError(w, http.StatusBadRequest, "Token is empty or invalid.")
		return false
	}
	if state == "" {
		RespondWithError(w, http.StatusBadRequest, "State parameter is empty or invalid.")
		return false
	}

	// CSRF mitigation
	separator := strings.LastIndexByte(state, '-')
	if separator != -1 {
		csrfToken, timestamp := state[:separator], state[separator+1:]
		csrfHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", nonceCookie.Value, timestamp, config.GetSigningKey())))

		if fmt.Sprintf("%x", csrfHash) != csrfToken {
			RespondWithError(w, http.StatusForbidden, "Request rejected because of CSRF mitigation.")
			return false
		}
	} else {
		RespondWithError(w, http.StatusBadRequest, "State parameter is invalid.")
		return false
	}

	// Parse the received id_token from the IdP and check nonce code
	parsedIdToken, _, err := new(jwt.Parser).ParseUnverified(token, jwt.MapClaims{})
	if err != nil {
		RespondWithDetailedError(w, http.StatusUnauthorized, "Cannot parse received id_token from the OpenId provider", err.Error())
		return false
	}
	idTokenClaims := parsedIdToken.Claims.(jwt.MapClaims)
	if nonceClaim, ok := idTokenClaims["nonce"]; !ok || fmt.Sprintf("%x", nonceHash) != nonceClaim.(string) {
		RespondWithError(w, http.StatusUnauthorized, "Received token from the OpenID provider is invalid (nonce code mismatch)")
		return false
	}

	// Set a default value for expiration date
	expiresOn := time.Now().Add(time.Second * time.Duration(defaultSessionDuration))

	// If the expiration date is present on the claim, we use that
	if expClaim := idTokenClaims["exp"].(string); expClaim != "" {
		expiresInNumber, err := strconv.ParseInt(expClaim, 10, 64)

		if err != nil {
			RespondWithDetailedError(w, http.StatusBadRequest, "Token exp claim is present, but invalid.", err.Error())
			return false
		}

		expiresOn = time.Unix(expiresInNumber, 0)
	}

	// Create business layer using the received id_token
	business, err := business.Get(token)
	if err != nil {
		RespondWithDetailedError(w, http.StatusInternalServerError, "Error instantiating the business layer", err.Error())
		return false
	}

	// Using the namespaces API to check if token is valid. In Kubernetes, the version API seems to allow
	// anonymous access, so it's not feasible to use the version API for token verification.
	nsList, err := business.Namespace.GetNamespaces()
	if err != nil {
		RespondWithDetailedError(w, http.StatusUnauthorized, "Token is not valid or is expired", err.Error())
		return false
	}

	// If namespace list is empty, return unauthorized error
	if len(nsList) == 0 {
		RespondWithError(w, http.StatusUnauthorized, "Not enough privileges to login")
		return false
	}

	// Now that we know that the ServiceAccount token is valid, parse/decode it to extract
	// the name of the service account. The "subject" is passed to the front-end to be displayed.
	tokenSubject := "OpenId User" // Set a default value
	if userClaim, ok := idTokenClaims[config.Get().Auth.OpenId.UsernameClaim]; ok && len(userClaim.(string)) > 0 {
		tokenSubject = userClaim.(string)
	}

	tokenClaims := config.IanaClaims{
		SessionId: token,
		StandardClaims: jwt.StandardClaims{
			Subject:   tokenSubject,
			ExpiresAt: expiresOn.Unix(),
			Issuer:    config.AuthStrategyOpenIdIssuer,
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
		SameSite: http.SameSiteStrictMode,
	}
	http.SetCookie(w, &tokenCookie)

	RespondWithJSONIndent(w, http.StatusOK, TokenResponse{Token: tokenString, ExpiresOn: expiresOn.Format(time.RFC1123Z), Username: tokenSubject})
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

	business, err := business.Get(token)
	if err != nil {
		RespondWithDetailedError(w, http.StatusInternalServerError, "Error instantiating the business layer", err.Error())
		return false
	}

	// Using the namespaces API to check if token is valid. In Kubernetes, the version API seems to allow
	// anonymous access, so it's not feasible to use the version API for token verification.
	nsList, err := business.Namespace.GetNamespaces()
	if err != nil {
		RespondWithDetailedError(w, http.StatusUnauthorized, "Token is not valid or is expired", err.Error())
		return false
	}

	// If namespace list is empty, return unauthorized error
	if len(nsList) == 0 {
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
		log.Warningf("Token is invalid: %s", err.Error())
		return http.StatusInternalServerError, err
	} else {
		business, err := business.Get(claims.SessionId)
		if err != nil {
			log.Warning("Could not get the business layer : ", err)
			return http.StatusInternalServerError, err
		}

		err = business.OpenshiftOAuth.Logout(claims.SessionId)
		if err != nil {
			log.Warning("Could not log out of OpenShift: ", err)
			return http.StatusInternalServerError, err
		}

		return http.StatusNoContent, nil
	}
}

// performLDAPAuthentication is to authenticate user using LDAP
func performLDAPAuthentication(w http.ResponseWriter, r *http.Request) bool {
	//Handle request correlation ID
	conf := config.Get()
	var token ldap.Token
	var username string
	var user ldap.User
	var tknErr error
	oldToken := getTokenStringFromRequest(r)
	if len(oldToken) == 0 {
		var err error
		user, err = ldap.ValidateUser(r, conf.Auth)
		if err != nil {
			RespondWithCode(w, http.StatusUnauthorized)
			return false
		}
		username = user.Username
	} else {
		userInfo, err := ldap.ValidateToken(oldToken)
		if err != nil {
			log.Warning("Token error: ", err)
			return false
		}
		user = *userInfo.Status.User
		username = user.Username
	}

	token, tknErr = ldap.GenerateToken(user, conf.Auth)
	if tknErr != nil {
		RespondWithJSONIndent(w, http.StatusInternalServerError, tknErr)
		return false
	}

	tokenCookie := http.Cookie{
		Name:     config.TokenCookieName,
		Value:    token.JWT,
		Expires:  token.Expiry,
		HttpOnly: true,
	}
	http.SetCookie(w, &tokenCookie)

	RespondWithJSONIndent(w, http.StatusOK, TokenResponse{Token: token.JWT, ExpiresOn: token.Expiry.Format(time.RFC1123Z), Username: username})
	return true
}

func checkKialiSession(w http.ResponseWriter, r *http.Request) int {
	if token := getTokenStringFromRequest(r); len(token) > 0 {
		user, err := config.ValidateToken(token)

		if err != nil {
			log.Warning("Token error: ", err)
			return http.StatusUnauthorized
		}

		// Internal header used to propagate the subject of the request for audit purposes
		r.Header.Add("Kiali-User", user)
	} else {
		user := checkKialiCredentials(r)
		if len(user) == 0 {
			conf := config.Get()
			if conf.Server.Credentials.Username == "" && conf.Server.Credentials.Passphrase == "" {
				log.Error("Credentials are missing. Create a secret. Please refer to the documentation for more details.")
				return missingSecretStatusCode // our specific error code that indicates to the client that we are missing the secret
			} else {
				return http.StatusUnauthorized
			}
		}

		// Internal header used to propagate the subject of the request for audit purposes
		r.Header.Add("Kiali-User", user)
	}

	return http.StatusOK
}

func checkOpenshiftSession(w http.ResponseWriter, r *http.Request) (int, string) {
	tokenString := getTokenStringFromRequest(r)
	if claims, err := config.GetTokenClaimsIfValid(tokenString); err != nil {
		log.Warningf("Token is invalid: %s", err.Error())
	} else {
		// Session ID claim must be present
		if len(claims.SessionId) == 0 {
			log.Warning("Token is invalid: sid claim is required")
			return http.StatusUnauthorized, ""
		}

		business, err := business.Get(claims.SessionId)
		if err != nil {
			log.Warning("Could not get the business layer : ", err)
			return http.StatusInternalServerError, ""
		}

		_, err = business.OpenshiftOAuth.GetUserInfo(claims.SessionId)
		if err == nil {
			// Internal header used to propagate the subject of the request for audit purposes
			r.Header.Add("Kiali-User", claims.Subject)
			return http.StatusOK, claims.SessionId
		}

		log.Warning("Token error: ", err)
	}

	return http.StatusUnauthorized, ""
}

func checkOpenIdSession(w http.ResponseWriter, r *http.Request) (int, string) {
	tokenString := getTokenStringFromRequest(r)
	if claims, err := config.GetTokenClaimsIfValid(tokenString); err != nil {
		log.Warningf("Token is invalid: %s", err.Error())
	} else {
		// Session ID claim must be present
		if len(claims.SessionId) == 0 {
			log.Warning("Token is invalid: sid claim is required")
			return http.StatusUnauthorized, ""
		}

		business, err := business.Get(claims.SessionId)
		if err != nil {
			log.Warning("Could not get the business layer : ", err)
			return http.StatusInternalServerError, ""
		}

		// Parse the sid claim (id_token) to check that the sub claim matches to the configured "username" claim of the id_token
		parsedIdToken, _, err := new(jwt.Parser).ParseUnverified(claims.SessionId, jwt.MapClaims{})
		if err != nil {
			log.Warning("Cannot parse sid claim of the Kiali token : ", err)
			return http.StatusInternalServerError, ""
		}
		if userClaim, ok := parsedIdToken.Claims.(jwt.MapClaims)[config.Get().Auth.OpenId.UsernameClaim]; ok && claims.Subject != userClaim {
			log.Warning("Kiali token rejected because of subject claim mismatch")
			return http.StatusUnauthorized, ""
		}

		_, err = business.Namespace.GetNamespaces()
		if err == nil {
			// Internal header used to propagate the subject of the request for audit purposes
			r.Header.Add("Kiali-User", claims.Subject)
			return http.StatusOK, claims.SessionId
		}

		log.Warning("Token error: ", err)
	}

	return http.StatusUnauthorized, ""
}

// checkLDAPSession is to check validity of the LDAP session
func checkLDAPSession(w http.ResponseWriter, r *http.Request) (int, string) {
	// Validate token
	if token := getTokenStringFromRequest(r); len(token) > 0 {
		user, err := ldap.ValidateToken(token)
		if err != nil {
			log.Warning("Token error: ", err)
			return http.StatusUnauthorized, ""
		}
		// Internal header used to propagate the subject of the request for audit purposes
		r.Header.Add("Kiali-User", user.Status.User.Username)
		return http.StatusOK, token
	}
	return http.StatusUnauthorized, ""
}

func checkTokenSession(w http.ResponseWriter, r *http.Request) (int, string) {
	tokenString := getTokenStringFromRequest(r)
	if claims, err := config.GetTokenClaimsIfValid(tokenString); err != nil {
		log.Warningf("Token is invalid: %s", err.Error())
	} else {
		// Session ID claim must be present
		if len(claims.SessionId) == 0 {
			log.Warning("Token is invalid: sid claim is required")
			return http.StatusUnauthorized, ""
		}

		business, err := business.Get(claims.SessionId)
		if err != nil {
			log.Warning("Could not get the business layer : ", err)
			return http.StatusInternalServerError, ""
		}

		_, err = business.Namespace.GetNamespaces()
		if err == nil {
			// Internal header used to propagate the subject of the request for audit purposes
			r.Header.Add("Kiali-User", claims.Subject)
			return http.StatusOK, claims.SessionId
		}

		log.Warning("Token error: ", err)
	}

	return http.StatusUnauthorized, ""
}

func writeAuthenticateHeader(w http.ResponseWriter, r *http.Request) {
	// If header exists return the value, must be 1 to use the API from Kiali
	// Otherwise an empty string is returned and WWW-Authenticate will be Basic
	if r.Header.Get("X-Auth-Type-Kiali-UI") == "1" {
		w.Header().Set("WWW-Authenticate", "xBasic realm=\"Kiali\"")
	} else {
		w.Header().Set("WWW-Authenticate", "Basic realm=\"Kiali\"")
	}
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

		var token string

		switch conf.Auth.Strategy {
		case config.AuthStrategyOpenshift:
			statusCode, token = checkOpenshiftSession(w, r)
		case config.AuthStrategyOpenId:
			statusCode, token = checkOpenIdSession(w, r)
		case config.AuthStrategyLogin:
			statusCode = checkKialiSession(w, r)
			token = aHandler.saToken
		case config.AuthStrategyToken:
			statusCode, token = checkTokenSession(w, r)
		case config.AuthStrategyAnonymous:
			log.Tracef("Access to the server endpoint is not secured with credentials - letting request come in. Url: [%s]", r.URL.String())
			token = aHandler.saToken
		case config.AuthStrategyLDAP:
			statusCode, _ = checkLDAPSession(w, r)
			token = aHandler.saToken
		}

		switch statusCode {
		case http.StatusOK:
			context := context.WithValue(r.Context(), "token", token)
			next.ServeHTTP(w, r.WithContext(context))
		case http.StatusUnauthorized:
			if conf.Auth.Strategy == config.AuthStrategyLogin {
				writeAuthenticateHeader(w, r)
			}
			http.Error(w, http.StatusText(http.StatusUnauthorized), http.StatusUnauthorized)
		case missingSecretStatusCode:
			http.Error(w, "Credentials are missing. Create a secret. Please refer to the documentation for more details", statusCode)
		default:
			http.Error(w, http.StatusText(statusCode), statusCode)
			log.Errorf("Cannot send response to unauthorized user: %v", statusCode)
		}
	})
}

func (aHandler AuthenticationHandler) HandleUnauthenticated(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		context := context.WithValue(r.Context(), "token", "")
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
	case config.AuthStrategyLogin:
		if !performKialiAuthentication(w, r) {
			writeAuthenticateHeader(w, r)
		}
	case config.AuthStrategyToken:
		performTokenAuthentication(w, r)
	case config.AuthStrategyAnonymous:
		log.Warning("Authentication attempt with anonymous access enabled.")
	case config.AuthStrategyLDAP:
		// Code to do LDAP Authentication
		if !performLDAPAuthentication(w, r) {
			writeAuthenticateHeader(w, r)
		}
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
	case config.AuthStrategyLogin:
		if conf.Server.Credentials.Username == "" && conf.Server.Credentials.Passphrase == "" {
			response.SecretMissing = true
		}
	}

	token := getTokenStringFromRequest(r)
	if claims, _ := config.GetTokenClaimsIfValid(token); claims != nil {
		response.SessionInfo = sessionInfo{
			ExpiresOn: time.Unix(claims.ExpiresAt, 0).Format(time.RFC1123Z),
			Username:  claims.Subject,
		}
	}

	RespondWithJSON(w, http.StatusOK, response)
}

func Logout(w http.ResponseWriter, r *http.Request) {
	_, err := r.Cookie(config.TokenCookieName)

	if err != http.ErrNoCookie {
		tokenCookie := http.Cookie{
			Name:     config.TokenCookieName,
			Value:    "",
			Expires:  time.Unix(0, 0),
			HttpOnly: true,
			SameSite: http.SameSiteStrictMode,
		}
		http.SetCookie(w, &tokenCookie)
	}

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
		Name:     openIdNonceCookieName,
		Path:     conf.Server.WebRoot,
		SameSite: http.SameSiteStrictMode,
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

	// Send redirection to browser
	redirectUri := fmt.Sprintf("%s?client_id=%s&response_type=id_token&redirect_uri=%s&scope=%s&nonce=%s&state=%s",
		authorizationEndpoint,
		url.QueryEscape(conf.Auth.OpenId.ClientId),
		url.QueryEscape(httputil.GuessKialiURL(r)),
		url.QueryEscape(scopes),
		url.QueryEscape(fmt.Sprintf("%x", nonceHash)),
		url.QueryEscape(fmt.Sprintf("%x-%s", csrfHash, nowTime.UTC().Format("060102150405"))),
	)
	http.Redirect(w, r, redirectUri, http.StatusFound)
}
