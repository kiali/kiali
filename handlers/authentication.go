package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/handlers/authentication"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util/httputil"
)

type AuthenticationHandler struct {
	conf                *config.Config
	authController      authentication.AuthController
	homeClusterSAClient kubernetes.ClientInterface
	kialiSAClients      map[string]kubernetes.ClientInterface
	authRedirectHandler http.Handler
}

type AuthInfo struct {
	Strategy                        string            `json:"strategy"`
	AuthorizationEndpoint           string            `json:"authorizationEndpoint,omitempty"`
	AuthorizationEndpointPerCluster map[string]string `json:"authorizationEndpointPerCluster,omitempty"`
	LogoutEndpoint                  string            `json:"logoutEndpoint,omitempty"`
	LogoutRedirect                  string            `json:"logoutRedirect,omitempty"`
	SessionInfo                     sessionInfo       `json:"sessionInfo"`
	SecretMissing                   bool              `json:"secretMissing,omitempty"`
}

type sessionClusterInfo struct {
	Name string `json:"name,omitempty"`
}

// sessionInfo represents all the logged in sessions across all clusters
// which could be different users for each cluster or the same user for all clusters
// depending on the authentication strategy. The top level username and expires fields
// represent the "kiali home cluster" session. This probably should change in the future
// where you don't need to login to the home cluster to login to other clusters.
type sessionInfo struct {
	// ClusterInfo represents the clusters you are logged into for this session.
	ClusterInfo map[string]sessionClusterInfo `json:"clusterInfo,omitempty"`
	ExpiresOn   string                        `json:"expiresOn,omitempty"`
	Username    string                        `json:"username,omitempty"`
}

func NewAuthenticationHandler(
	conf *config.Config,
	authController authentication.AuthController,
	homeClusterSAClient kubernetes.ClientInterface,
	authRedirectHandler http.Handler,
	kialiSAClients map[string]kubernetes.ClientInterface,
) AuthenticationHandler {
	return AuthenticationHandler{
		authController:      authController,
		authRedirectHandler: authRedirectHandler,
		conf:                conf,
		homeClusterSAClient: homeClusterSAClient,
		kialiSAClients:      kialiSAClients,
	}
}

func (aHandler *AuthenticationHandler) Handle(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		statusCode := http.StatusOK
		userSessions := make(authentication.UserSessions)

		switch authStrategy := aHandler.conf.Auth.Strategy; authStrategy {
		case config.AuthStrategyToken, config.AuthStrategyOpenId, config.AuthStrategyOpenshift, config.AuthStrategyHeader:
			sessions, err := aHandler.authController.ValidateSession(r, w)
			if err != nil {
				if errors.Is(err, authentication.ErrSessionNotFound) {
					statusCode = http.StatusUnauthorized
				} else {
					log.Errorf("Failed to validate session: %s", err.Error())
					statusCode = http.StatusInternalServerError
				}
			} else {
				userSessions = sessions
				statusCode = http.StatusOK
			}
		case config.AuthStrategyAnonymous:
			log.Tracef("Access to the server endpoint is not secured with credentials - letting request come in. Url: [%s]", r.URL.String())
			for cluster, client := range aHandler.kialiSAClients {
				userSessions[cluster] = &authentication.UserSessionData{
					AuthInfo: &api.AuthInfo{Token: client.GetToken()},
				}
			}
		}

		switch statusCode {
		case http.StatusOK:
			if len(userSessions) == 0 {
				http.Error(w, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
				log.Errorf("No active user session: %v", http.StatusBadRequest)
				return
			}
			ctx := authentication.SetAuthInfoContext(r.Context(), userSessions.GetAuthInfos())
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

func (aHandler *AuthenticationHandler) HandleUnauthenticated(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authInfos := make(map[string]*api.AuthInfo)
		for cluster := range aHandler.kialiSAClients {
			authInfos[cluster] = &api.AuthInfo{Token: ""}
		}
		ctx := authentication.SetAuthInfoContext(r.Context(), authInfos)
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
			log.Errorf("%s", message)
			RespondWithError(w, http.StatusInternalServerError, message)
		}
	}
}

func AuthenticationInfo(conf *config.Config, authController authentication.AuthController, clusters []string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var response AuthInfo

		response.Strategy = conf.Auth.Strategy

		switch conf.Auth.Strategy {
		case config.AuthStrategyOpenshift:
			response.AuthorizationEndpoint = fmt.Sprintf("%s/api/auth/redirect", httputil.GuessKialiURL(conf, r))
			response.AuthorizationEndpointPerCluster = make(map[string]string)
			for _, cluster := range clusters {
				response.AuthorizationEndpointPerCluster[cluster] = fmt.Sprintf("%s/api/auth/redirect/%s", httputil.GuessKialiURL(conf, r), cluster)
			}
		case config.AuthStrategyOpenId:
			// Do the redirection through an intermediary own endpoint
			response.AuthorizationEndpoint = fmt.Sprintf("%s/api/auth/openid_redirect",
				httputil.GuessKialiURL(conf, r))
		}

		if conf.Auth.Strategy != config.AuthStrategyAnonymous {
			sessions, err := authController.ValidateSession(r, w)
			if err != nil {
				log.Debugf("Unable to validate session: %v", err)
			}

			response.SessionInfo.ClusterInfo = make(map[string]sessionClusterInfo)
			// TODO: Handle different usernames and expiration dates for different sessions.
			for cluster, session := range sessions {
				response.SessionInfo.ClusterInfo[cluster] = sessionClusterInfo{Name: cluster}
				if cluster == conf.KubernetesConfig.ClusterName {
					response.SessionInfo.ExpiresOn = session.ExpiresOn.Format(time.RFC1123Z)
					response.SessionInfo.Username = session.Username
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
