package handlers

import (
	"fmt"
	"net/http"
	"time"

	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/business/authentication"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util/httputil"
)

type AuthenticationHandler struct {
	conf                config.Config
	authController      authentication.AuthController
	homeClusterSAClient kubernetes.ClientInterface
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

func NewAuthenticationHandler(conf config.Config, authController authentication.AuthController, homeClusterSAClient kubernetes.ClientInterface) AuthenticationHandler {
	return AuthenticationHandler{authController: authController, conf: conf, homeClusterSAClient: homeClusterSAClient}
}

func (aHandler AuthenticationHandler) Handle(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		statusCode := http.StatusOK

		var authInfo *api.AuthInfo

		switch aHandler.conf.Auth.Strategy {
		case config.AuthStrategyToken, config.AuthStrategyOpenId, config.AuthStrategyOpenshift, config.AuthStrategyHeader:
			session, validateErr := aHandler.authController.ValidateSession(r, w)
			if validateErr != nil {
				statusCode = http.StatusInternalServerError
			} else if session != nil {
				authInfo = session.AuthInfo
				statusCode = http.StatusOK
			} else {
				statusCode = http.StatusUnauthorized
			}
		case config.AuthStrategyAnonymous:
			log.Tracef("Access to the server endpoint is not secured with credentials - letting request come in. Url: [%s]", r.URL.String())
			authInfo = &api.AuthInfo{Token: aHandler.homeClusterSAClient.GetToken()}
		}

		switch statusCode {
		case http.StatusOK:
			if authInfo == nil {
				http.Error(w, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
				log.Errorf("No authInfo: %v", http.StatusBadRequest)
			}
			ctx := authentication.SetAuthInfoContext(r.Context(), authInfo)
			next.ServeHTTP(w, r.WithContext(ctx))
		case http.StatusUnauthorized:
			err := aHandler.authController.TerminateSession(r, w)
			if err != nil {
				log.Errorf("Failed to clean a stale session: %s", err.Error())
			}
			http.Error(w, http.StatusText(http.StatusUnauthorized), http.StatusUnauthorized)
		default:
			http.Error(w, http.StatusText(statusCode), statusCode)
			log.Errorf("Cannot send response to unauthorized user: %v", statusCode)
		}
	})
}

func (aHandler AuthenticationHandler) HandleUnauthenticated(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := authentication.SetAuthInfoContext(r.Context(), &api.AuthInfo{Token: ""})
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func Authenticate(conf *config.Config, authController authentication.AuthController) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch conf.Auth.Strategy {
		case config.AuthStrategyToken, config.AuthStrategyOpenId, config.AuthStrategyOpenshift, config.AuthStrategyHeader:
			response, err := authController.Authenticate(r, w)
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
		case config.AuthStrategyAnonymous:
			log.Warning("Authentication attempt with anonymous access enabled.")
		default:
			message := fmt.Sprintf("Cannot authenticate users, because strategy <%s> is unknown.", conf.Auth.Strategy)
			log.Errorf(message)
			RespondWithError(w, http.StatusInternalServerError, message)
		}
	}
}

func AuthenticationInfo(conf *config.Config, authController authentication.AuthController) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var response AuthInfo

		response.Strategy = conf.Auth.Strategy

		switch conf.Auth.Strategy {
		case config.AuthStrategyOpenshift:
			token, _, err := kubernetes.GetKialiTokenForHomeCluster()
			if err != nil {
				RespondWithDetailedError(w, http.StatusInternalServerError, "Error obtaining Kiali SA token", err.Error())
				return
			}

			layer, err := business.Get(&api.AuthInfo{Token: token})
			if err != nil {
				RespondWithDetailedError(w, http.StatusInternalServerError, "Error authenticating (getting business layer)", err.Error())
				return
			}

			metadata, err := layer.OpenshiftOAuth.Metadata(r)
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
				httputil.GuessKialiURL(conf, r))
		}

		if conf.Auth.Strategy != config.AuthStrategyAnonymous {
			session, _ := authController.ValidateSession(r, w)
			if session != nil {
				response.SessionInfo = sessionInfo{
					ExpiresOn: session.ExpiresOn.Format(time.RFC1123Z),
					Username:  session.Username,
				}
			}
		}

		RespondWithJSON(w, http.StatusOK, response)
	}
}

func Logout(conf *config.Config, authController authentication.AuthController) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if conf.Auth.Strategy == config.AuthStrategyAnonymous {
			RespondWithCode(w, http.StatusNoContent)
		} else {
			err := authController.TerminateSession(r, w)
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
}
