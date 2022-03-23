package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/dgrijalva/jwt-go"
	"k8s.io/apimachinery/pkg/util/uuid"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/business/authentication"
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
		case config.AuthStrategyToken, config.AuthStrategyOpenId, config.AuthStrategyOpenshift:
			session, validateErr := authentication.GetAuthController().ValidateSession(r, w)
			if validateErr != nil {
				statusCode = http.StatusInternalServerError
			} else if session != nil {
				token = session.Token
				authInfo = &api.AuthInfo{Token: token}
				statusCode = http.StatusOK
			} else {
				statusCode = http.StatusUnauthorized
			}
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
	case config.AuthStrategyToken, config.AuthStrategyOpenId, config.AuthStrategyOpenshift:
		response, err := authentication.GetAuthController().Authenticate(r, w)
		if err != nil {
			if e, ok := err.(*authentication.AuthenticationFailureError); ok {
				status := http.StatusUnauthorized
				if e.HttpStatus != 0 {
					status = e.HttpStatus
				}
				RespondWithError(w, status, e.Error())
			} else {
				RespondWithError(w, http.StatusInternalServerError, err.Error())
			}
		} else {
			RespondWithJSONIndent(w, http.StatusOK, response)
		}
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

	if conf.Auth.Strategy != config.AuthStrategyToken && conf.Auth.Strategy != config.AuthStrategyOpenId {
		token := getTokenStringFromRequest(r)
		claims, _ := config.GetTokenClaimsIfValid(token)

		if claims != nil {
			response.SessionInfo = sessionInfo{
				ExpiresOn: time.Unix(claims.ExpiresAt, 0).Format(time.RFC1123Z),
				Username:  claims.Subject,
			}
		}
	} else {
		session, _ := authentication.GetAuthController().ValidateSession(r, w)
		if session != nil {
			response.SessionInfo = sessionInfo{
				ExpiresOn: session.ExpiresOn.Format(time.RFC1123Z),
				Username:  session.Username,
			}
		}
	}

	RespondWithJSON(w, http.StatusOK, response)
}

func Logout(w http.ResponseWriter, r *http.Request) {
	conf := config.Get()

	if conf.Auth.Strategy == config.AuthStrategyAnonymous || conf.Auth.Strategy == config.AuthStrategyHeader {
		deleteTokenCookies(w, r)
		RespondWithCode(w, http.StatusNoContent)
	} else {
		err := authentication.GetAuthController().TerminateSession(r, w)
		if err != nil {
			if e, ok := err.(*authentication.TerminateSessionError); ok {
				RespondWithError(w, e.HttpStatus, e.Error())
			} else {
				RespondWithError(w, http.StatusInternalServerError, err.Error())
			}
		} else {
			RespondWithCode(w, http.StatusNoContent)
		}
	}
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
