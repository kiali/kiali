package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

type AuthInfo struct {
	Strategy              string      `json:"strategy"`
	AuthorizationEndpoint string      `json:"authorizationEndpoint,omitempty"`
	SessionInfo           sessionInfo `json:"sessionInfo"`
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
	// example: 2018-06-20 19:40:54.116369887 +0000 UTC m=+43224.838320603
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
	user := checkKialiCredentials(r)

	if len(user) == 0 {
		RespondWithCode(w, http.StatusUnauthorized)
		return false
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
		// SameSite: http.SameSiteStrictMode, ** Commented out because unsupported in go < 1.11
	}
	http.SetCookie(w, &tokenCookie)

	RespondWithJSONIndent(w, http.StatusOK, TokenResponse{Token: token.Token, ExpiresOn: token.ExpiresOn.String(), Username: user})
	return true
}

func performOpenshiftAuthentication(w http.ResponseWriter, r *http.Request) bool {
	err := r.ParseForm()

	if err != nil {
		RespondWithJSONIndent(w, http.StatusInternalServerError, fmt.Errorf("Error parsing form info: %+v", err))
		return false
	}

	token := r.Form.Get("access_token")
	expiresIn := r.Form.Get("expires_in")

	expiresInNumber, err := strconv.Atoi(expiresIn)

	if token == "" || expiresIn == "" || err != nil {
		RespondWithJSONIndent(w, http.StatusInternalServerError, "Token is empty or invalid.")
		return false
	}

	expiresOn := time.Now().Add(time.Second * time.Duration(expiresInNumber))

	business, err := business.Get()
	if err != nil {
		RespondWithJSONIndent(w, http.StatusInternalServerError, "Error retrieving the OAuth package.")
	}

	err = business.OpenshiftOAuth.ValidateToken(token)

	if err != nil {
		RespondWithJSONIndent(w, http.StatusUnauthorized, "Token is not valid or is expired.")
		return false
	}

	user, err := business.OpenshiftOAuth.GetUserInfo(token)

	if err != nil {
		RespondWithJSONIndent(w, http.StatusUnauthorized, "Token is not valid or is expired.")
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
		// SameSite: http.SameSiteStrictMode, ** Commented out because unsupported in go < 1.11
	}
	http.SetCookie(w, &tokenCookie)

	RespondWithJSONIndent(w, http.StatusOK, TokenResponse{Token: tokenString, ExpiresOn: expiresOn.String(), Username: user.Metadata.Name})
	return true
}

func checkOpenshiftSession(w http.ResponseWriter, r *http.Request) int {
	business, err := business.Get()

	if err != nil {
		log.Warning("Could not get business layer: ", err)
		return http.StatusInternalServerError
	} else {
		tokenString := getTokenStringFromRequest(r)
		if claims, err := config.GetTokenClaimsIfValid(tokenString); err != nil {
			log.Warningf("Token is invalid: %s", err.Error())
		} else {
			err := business.OpenshiftOAuth.ValidateToken(claims.SessionId)
			if err == nil {
				// Internal header used to propagate the subject of the request for audit purposes
				w.Header().Add("Kiali-User", claims.Subject)
				return http.StatusOK
			}

			log.Warning("Token error: ", err)
		}
	}

	return http.StatusUnauthorized
}

func checkKialiSession(w http.ResponseWriter, r *http.Request) int {
	if token := getTokenStringFromRequest(r); len(token) > 0 {
		user, err := config.ValidateToken(token)

		if err != nil {
			log.Warning("Token error: ", err)
			return http.StatusUnauthorized
		}

		// Internal header used to propagate the subject of the request for audit purposes
		w.Header().Add("Kiali-User", user)
	} else {
		user := checkKialiCredentials(r)
		if len(user) == 0 {
			conf := config.Get()
			if conf.Server.Credentials.Username == "" && conf.Server.Credentials.Passphrase == "" {
				if conf.Server.Credentials.AllowAnonymous {
					log.Trace("Access to the server endpoint is not secured with credentials - letting anonymous request come in")
					user = "anonymous"
				} else {
					log.Error("Credentials are missing. Create a secret. Please refer to the documentation for more details.")
					return 520 // our specific error code that indicates to the client that we are missing the secret
				}
			} else {
				return http.StatusUnauthorized
			}
		}

		// Internal header used to propagate the subject of the request for audit purposes
		w.Header().Add("Kiali-User", user)
	}

	return http.StatusOK
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

func AuthenticationHandler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		statusCode := http.StatusOK
		conf := config.Get()

		switch conf.Auth.Strategy {
		case config.AuthStrategyOpenshift:
			statusCode = checkOpenshiftSession(w, r)
		case config.AuthStrategyLogin:
			statusCode = checkKialiSession(w, r)
		case config.AuthStrategyAnonymous:
			log.Trace("Access to the server endpoint is not secured with credentials - letting request come in")
		}

		switch statusCode {
		case http.StatusOK:
			next.ServeHTTP(w, r)
		case http.StatusUnauthorized:
			if conf.Auth.Strategy == config.AuthStrategyLogin {
				writeAuthenticateHeader(w, r)
			}
			http.Error(w, http.StatusText(http.StatusUnauthorized), http.StatusUnauthorized)
		default:
			http.Error(w, http.StatusText(statusCode), statusCode)
			log.Errorf("Cannot send response to unauthorized user: %v", statusCode)
		}
	})
}

func Authenticate(w http.ResponseWriter, r *http.Request) {
	conf := config.Get()
	switch conf.Auth.Strategy {
	case config.AuthStrategyOpenshift:
		performOpenshiftAuthentication(w, r)
	case config.AuthStrategyLogin:
		if !performKialiAuthentication(w, r) {
			writeAuthenticateHeader(w, r)
		}
	case config.AuthStrategyAnonymous:
		log.Warning("Authentication attempt with anonymous access enabled.")
	default:
		log.Errorf("Cannot authenticate users, because strategy <%s> is unknown.", conf.Auth.Strategy)
		RespondWithJSONIndent(w, http.StatusInternalServerError, "Authentication strategy is not configured correctly.")
	}
}

func AuthenticationInfo(w http.ResponseWriter, r *http.Request) {
	var response AuthInfo

	conf := config.Get()

	response.Strategy = conf.Auth.Strategy

	switch conf.Auth.Strategy {
	case config.AuthStrategyOpenshift:
		business, err := business.Get()

		if err != nil {
			RespondWithJSONIndent(w, http.StatusInternalServerError, "Error trying to get business layer")
			return
		}

		metadata, err := business.OpenshiftOAuth.Metadata()

		if err != nil {
			RespondWithJSONIndent(w, http.StatusInternalServerError, "Error trying to get OAuth metadata")
			return
		}

		response.AuthorizationEndpoint = metadata.AuthorizationEndpoint
	}

	token := getTokenStringFromRequest(r)
	if claims, _ := config.GetTokenClaimsIfValid(token); claims != nil {
		response.SessionInfo = sessionInfo{
			ExpiresOn: time.Unix(claims.ExpiresAt, 0).String(),
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
			// SameSite: http.SameSiteStrictMode, ** Commented out because unsupported in go < 1.11
		}
		http.SetCookie(w, &tokenCookie)
	}

	RespondWithCode(w, http.StatusNoContent)
}
