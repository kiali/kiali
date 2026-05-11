package handlers

import (
	"crypto/sha256"
	"crypto/subtle"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/handlers/authentication"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util/httputil"
)

// AnonymousSessionID is the session ID used for anonymous/unauthenticated users.
// All anonymous users share this single session ID.
const AnonymousSessionID = "anonymous-shared"

//  Token length constants (prevent abuse)
const (
	minTokenLength = 32
	maxTokenLength = 2048
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

// sessionInfo represents all the logged in sessions across all clusters.
type sessionInfo struct {
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

// Token validation helper (format + length guard)
func validateTokenFormat(token string) error {
	if token == "" {
		return errors.New("missing authorization header")
	}
	if !strings.HasPrefix(token, "Bearer ") {
		return errors.New("invalid token format: must start with 'Bearer '")
	}
	tokenValue := strings.TrimPrefix(token, "Bearer ")
	if len(tokenValue) < minTokenLength {
		return fmt.Errorf("token too short: minimum length is %d", minTokenLength)
	}
	if len(tokenValue) > maxTokenLength {
		return fmt.Errorf("token too long: maximum length is %d", maxTokenLength)
	}
	return nil
}

// Safe token fingerprint for logging (never log raw token)
func tokenFingerprint(token string) string {
	hash := sha256.Sum256([]byte(token))
	return fmt.Sprintf("%x", hash[:8])
}

// Constant time token comparison (prevent timing attacks)
func safeTokenCompare(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

func (aHandler *AuthenticationHandler) Handle(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		statusCode := http.StatusOK
		userSessions := make(authentication.UserSessions)

		switch authStrategy := aHandler.conf.Auth.Strategy; authStrategy {
		case config.AuthStrategyToken, config.AuthStrategyOpenId, config.AuthStrategyOpenshift, config.AuthStrategyHeader:

			// Validate token format BEFORE passing to controller
			rawToken := r.Header.Get("Authorization")
			if err := validateTokenFormat(rawToken); err != nil {
				log.Warnf("Token validation failed from IP [%s]: %s", r.RemoteAddr, err.Error())
				// Log fingerprint only, never raw token
				log.Debugf("Token fingerprint: %s", tokenFingerprint(rawToken))
				statusCode = http.StatusUnauthorized
				break
			}

			sessions, err := aHandler.authController.ValidateSession(r, w)
			if err != nil {
				if errors.Is(err, authentication.ErrSessionNotFound) {
					// Session doesn't exist - user needs to authenticate
					statusCode = http.StatusUnauthorized
				} else if k8serrors.IsUnauthorized(err) {
					// Kubernetes API rejected the token as invalid/expired
					statusCode = http.StatusUnauthorized
				} else if k8serrors.IsForbidden(err) {
					// Token is valid but user lacks sufficient RBAC privileges
					statusCode = http.StatusForbidden
					//  Do NOT expose internal error detail to client
					log.Errorf("User does not have sufficient privileges: %s", err.Error())
				} else {
					// Unexpected server error during validation
					// Log full error server-side, return generic message to client
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
					AuthInfo:  &api.AuthInfo{Token: client.GetToken()},
					SessionID: AnonymousSessionID, // All anonymous users share a single session ID
				}
			}
		}

		switch statusCode {
		case http.StatusOK:
			if len(userSessions) == 0 {
				//  Generic error message to client, detailed log server-side
				log.Errorf("No active user session found for request from IP [%s]", r.RemoteAddr)
				http.Error(w, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
				return
			}
			ctx := authentication.SetAuthInfoContext(r.Context(), userSessions.GetAuthInfos())
			// Extract session ID from home cluster session for graph caching
			if homeSession, ok := userSessions[aHandler.conf.KubernetesConfig.ClusterName]; ok {
				ctx = authentication.SetSessionIDContext(ctx, homeSession.SessionID)
			}
			next.ServeHTTP(w, r.WithContext(ctx))

		case http.StatusUnauthorized:
			//  Terminate stale session and log the attempt
			log.Warnf("Unauthorized access attempt from IP [%s] — terminating session", r.RemoteAddr)
			err := aHandler.authController.TerminateSession(r, w)
			if err != nil {
				log.Errorf("Failed to clean a stale session: %s", err.Error())
			}
			//  Generic response, no internal detail leaked
			http.Error(w, http.StatusText(http.StatusUnauthorized), http.StatusUnauthorized)

		case http.StatusForbidden:
			//  Authenticated but no privilege — do NOT terminate session
			log.Warnf("Forbidden access attempt from IP [%s] — user authenticated but lacks privileges", r.RemoteAddr)
			http.Error(w, http.StatusText(http.StatusForbidden), http.StatusForbidden)

		default:
			log.Errorf("Unexpected status code [%d] for request from IP [%s]", statusCode, r.RemoteAddr)
			http.Error(w, http.StatusText(statusCode), statusCode)
		}
	})
}

func (aHandler *AuthenticationHandler) HandleUnauthenticated(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authInfos := make(map[string]*api.AuthInfo)
		for cluster := range aHandler.kialiSAClients {
			//  Explicitly set empty token for unauthenticated context (no nil risk)
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

			//  Validate token format before hitting the auth controller
			rawToken := r.Header.Get("Authorization")
			if err := validateTokenFormat(rawToken); err != nil {
				log.Warnf("Authenticate: invalid token format from IP [%s]: %s", r.RemoteAddr, err.Error())
				RespondWithError(w, http.StatusUnauthorized, "Invalid or missing authorization token")
				return
			}

			//  Log fingerprint for traceability, never raw token
			log.Debugf("Authenticate: processing token fingerprint [%s] from IP [%s]",
				tokenFingerprint(rawToken), r.RemoteAddr)

			response, err := authController.Authenticate(r, w)
			if err != nil {
				if e, ok := err.(*authentication.AuthenticationFailureError); ok {
					status := http.StatusUnauthorized
					if e.HttpStatus != 0 {
						status = e.HttpStatus
					}
					//  Log full error, return sanitized message to client
					log.Errorf("Authentication failure from IP [%s]: %s", r.RemoteAddr, e.Error())
					RespondWithError(w, status, "Authentication failed")
				} else {
					log.Errorf("Unexpected auth error from IP [%s]: %s", r.RemoteAddr, err.Error())
					RespondWithError(w, http.StatusInternalServerError, "Internal server error")
				}
			} else {
				//  Log successful auth with fingerprint only
				log.Infof("Authenticate: successful login from IP [%s], token fingerprint [%s]",
					r.RemoteAddr, tokenFingerprint(rawToken))
				RespondWithJSONIndent(w, http.StatusOK, response)
			}

		case config.AuthStrategyAnonymous:
			//  Elevated log level from Warning to Info with context
			log.Infof("Authentication attempt received but anonymous access is enabled. IP: [%s]", r.RemoteAddr)

		default:
			message := fmt.Sprintf("Cannot authenticate users: unknown strategy [%s]", conf.Auth.Strategy)
			log.Errorf("%s", message)
			//  Generic message to client, strategy detail stays server-side
			RespondWithError(w, http.StatusInternalServerError, "Internal server error: unknown auth strategy")
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
				response.AuthorizationEndpointPerCluster[cluster] = fmt.Sprintf(
					"%s/api/auth/redirect/%s",
					httputil.GuessKialiURL(conf, r),
					cluster,
				)
			}
		case config.AuthStrategyOpenId:
			response.AuthorizationEndpoint = fmt.Sprintf("%s/api/auth/openid_redirect",
				httputil.GuessKialiURL(conf, r))
		}

		if conf.Auth.Strategy != config.AuthStrategyAnonymous {
			sessions, err := authController.ValidateSession(r, w)
			if err != nil {
				//  Log with IP context for better traceability
				log.Debugf("Unable to validate session for IP [%s]: %v", r.RemoteAddr, err)
			}

			response.SessionInfo.ClusterInfo = make(map[string]sessionClusterInfo)
			for cluster, session := range sessions {
				response.SessionInfo.ClusterInfo[cluster] = sessionClusterInfo{Name: cluster}
				if cluster == conf.KubernetesConfig.ClusterName {
					response.SessionInfo.ExpiresOn = session.ExpiresOn.Format(time.RFC1123Z)
					//  Validate username is not empty before setting
					if session.Username != "" {
						response.SessionInfo.Username = session.Username
					} else {
						log.Warnf("Session for cluster [%s] has empty username", cluster)
					}
				}
			}
		}

		RespondWithJSON(w, http.StatusOK, response)
	}
}

func Logout(conf *config.Config, authController authentication.AuthController) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if conf.Auth.Strategy == config.AuthStrategyAnonymous {
			//  Log anonymous logout attempts for audit trail
			log.Infof("Logout called with anonymous strategy from IP [%s] — no session to terminate", r.RemoteAddr)
			RespondWithCode(w, http.StatusNoContent)
		} else {
			//  Log logout initiation for audit trail
			log.Infof("Logout initiated from IP [%s]", r.RemoteAddr)
			err := authController.TerminateSession(r, w)
			if err != nil {
				if e, ok := err.(*authentication.TerminateSessionError); ok {
					log.Errorf("Failed to terminate session from IP [%s]: %s", r.RemoteAddr, e.Error())
					RespondWithError(w, e.HttpStatus, "Failed to terminate session")
				} else {
					log.Errorf("Unexpected error during logout from IP [%s]: %s", r.RemoteAddr, err.Error())
					RespondWithError(w, http.StatusInternalServerError, "Internal server error during logout")
				}
			} else {
				log.Infof("Session successfully terminated from IP [%s]", r.RemoteAddr)
				RespondWithCode(w, http.StatusNoContent)
			}
		}
	}
}


