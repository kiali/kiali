package authentication

import (
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util"
	"github.com/kiali/kiali/util/httputil"
)

// SessionCookieMaxSize is the maximum size of session cookies. This is 3.5K.
// Major browsers limit cookie size to 4K, but this includes
// metadata like expiration date, the cookie name, etc. So
// use 3.5K for cookie data and leave 0.5K for metadata.
const SessionCookieMaxSize = 3584

type SessionPersistor[T any] interface {
	CreateSession(r *http.Request, w http.ResponseWriter, s SessionData[T]) error
	ReadSession(r *http.Request, w http.ResponseWriter, key string) (sData *SessionData[T], err error)
	ReadAllSessions(r *http.Request, w http.ResponseWriter) (sessions []*SessionData[T], err error)
	TerminateSession(r *http.Request, w http.ResponseWriter, key string)
}

const (
	// SessionCookieName is the name of the cookie that holds the session data.
	// This is usually an encrypted api token.
	SessionCookieName = "kiali-token"
	// NonceCookieName is the cookie name used to store a nonce code
	// when user is starting authentication with the external server. This code
	// is used to mitigate replay attacks.
	NonceCookieName = "kiali-token-nonce"
	// NumberOfChunksCookieName is the name of the cookie that holds the number of chunks of a session.
	// This may or may not be set depending on the size of the session data.
	NumberOfChunksCookieName = "kiali-token-chunks"
)

// ErrSessionNotFound is returned when a session or sessions do not exist.
var ErrSessionNotFound = errors.New("not found")

func sessionCookieName(cookieName, key string) string {
	if key != "" {
		cookieName = cookieName + "-" + key
	}
	return cookieName
}

func sessionCookieChunkName(cookieName string, chunkNum int) string {
	return fmt.Sprintf("%s-%d", cookieName, chunkNum)
}

// NewSessionData create a new session object that you can then pass to CreateSession.
func NewSessionData[T any](key string, strategy string, expiresOn time.Time, payload *T) (*SessionData[T], error) {
	// Validate that there is a payload and a strategy. The strategy is required just in case Kiali is reconfigured with a
	// different strategy and drop any stale session. The payload is required because it does not make sense to start a session
	// if there is no data to persist.
	if payload == nil || len(strategy) == 0 {
		return nil, errors.New("a session cannot be created without strategy, or with a nil payload")
	}

	// Reject expiration time that is already in the past.
	if !util.Clock.Now().Before(expiresOn) {
		return nil, errors.New("the expiration time of a session cannot be in the past")
	}

	return &SessionData[T]{
		ExpiresOn: expiresOn,
		Key:       key,
		Strategy:  strategy,
		Payload:   payload,
	}, nil
}

// NewCookieSessionPersistor creates a new CookieSessionPersistor.
func NewCookieSessionPersistor[T any](conf *config.Config) (*cookieSessionPersistor[T], error) {
	block, err := aes.NewCipher([]byte(conf.LoginToken.SigningKey))
	if err != nil {
		return nil, fmt.Errorf("error when creating the cookie persistor - failed to create cipher: %w", err)
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("error when creating the cookie persistor - failed to create gcm: %w", err)
	}

	return &cookieSessionPersistor[T]{
		aesGCM: aesGCM,
		conf:   conf,
	}, nil
}

// CookieSessionPersistor is a session storage based on browser cookies. Session
// persistence is achieved by storing all session data in browser cookies. Only
// client-side storage is used and no back-end storage is needed.
// Browser cookies have size constraints and the workaround for large session data/payload
// is using multiple cookies. There is still a (browser dependant) limit on the
// number of cookies that a website can set but we haven't heard of a user
// facing problems because of reaching this limit.
type cookieSessionPersistor[T any] struct {
	aesGCM cipher.AEAD
	conf   *config.Config
}

// SessionData holds the data for a session and will be encrypted and stored in browser cookies.
// If the data is too large to fit in a browser cookie, it will be chunked and split over multiple cookies.
type SessionData[T any] struct {
	// ExpiresOn is the time when the session expires. This can be zero meaning the session never expires.
	ExpiresOn time.Time `json:"expiresOn"`

	// Key should be a unique identifier for the session.
	// For now this is just the cluster name.
	Key string `json:"key,omitempty"`

	// Payload is the data being saved.
	Payload *T `json:"payload,omitempty"`

	// Strategy is the auth stretegy used to create the session.
	// Must match the currently configured strategy to be considered valid.
	Strategy string `json:"strategy"`
}

// CreateSession starts a user session using HTTP Cookies for persistance across HTTP requests.
// For improved security, the data of the session is encrypted using the AES-GCM algorithm and
// the encrypted data is what is sent in cookies. The strategy, expiresOn and payload arguments
// are all required.
func (p *cookieSessionPersistor[T]) CreateSession(r *http.Request, w http.ResponseWriter, s SessionData[T]) error {
	// Serialize this structure. The resulting string
	// is what will be encrypted and stored in cookies.
	sDataJson, err := json.Marshal(s)
	if err != nil {
		return fmt.Errorf("error when creating the session - failed to marshal JSON: %w", err)
	}

	// The sDataJson string holds the session data that we want to persist.
	// It's time to encrypt this data which will result in an illegible sequence of bytes which are then
	// encoded to base64 get a string that is suitable to store in browser cookies.
	aesGcmNonce, err := util.CryptoRandomBytes(p.aesGCM.NonceSize())
	if err != nil {
		return fmt.Errorf("error when creating credentials - failed to generate random bytes: %w", err)
	}

	cipherSessionData := p.aesGCM.Seal(aesGcmNonce, aesGcmNonce, sDataJson, nil)
	base64SessionData := base64.StdEncoding.EncodeToString(cipherSessionData)

	// The base64SessionData holds what we want to store in browser cookies.
	// It's time to set/send the browser cookies to persist the session.

	// If the resulting session data is large, it may not fit in one cookie. So, the resulting
	// session data is broken in chunks and multiple cookies are used, as is needed.
	secureFlag := p.conf.IsServerHTTPS() || strings.HasPrefix(httputil.GuessKialiURL(p.conf, r), "https:")

	sessionDataChunks := chunkString(base64SessionData, SessionCookieMaxSize)
	for i, chunk := range sessionDataChunks {
		var cookieName string
		if i == 0 {
			// Set a cookie with the regular cookie name with the first chunk of session data.
			// Notice that an "-aes" suffix is being used in the cookie names. This is for backwards compatibility and
			// is/was meant to be able to differentiate between a session using cookies holding encrypted data, and the older
			// less secure sessions using cookies holding JWTs.
			cookieName = sessionCookieName(SessionCookieName, s.Key)
		} else {
			// If there are more chunks of session data (usually because of larger tokens from the IdP),
			// store the remainder data to numbered cookies.
			cookieName = sessionCookieChunkName(sessionCookieName(SessionCookieName, s.Key), i)
		}

		authCookie := http.Cookie{
			Name:     cookieName,
			Value:    chunk,
			Expires:  s.ExpiresOn,
			HttpOnly: true,
			Secure:   secureFlag,
			Path:     p.conf.Server.WebRoot,
			SameSite: http.SameSiteStrictMode,
		}
		http.SetCookie(w, &authCookie)
	}

	if len(sessionDataChunks) > 1 {
		// Set a cookie with the number of chunks of the session data.
		// This is to protect against reading spurious chunks of data if there is
		// any failure when killing the session or logging out.
		chunksCookie := http.Cookie{
			Name:     NumberOfChunksCookieName,
			Value:    strconv.Itoa(len(sessionDataChunks)),
			Expires:  s.ExpiresOn,
			HttpOnly: true,
			Secure:   secureFlag,
			Path:     p.conf.Server.WebRoot,
			SameSite: http.SameSiteStrictMode,
		}
		http.SetCookie(w, &chunksCookie)
	}

	return nil
}

func (p *cookieSessionPersistor[T]) readKialiCookie(cookieName string, r *http.Request) (*SessionData[T], error) {
	// This CookieSessionPersistor only deals with sessions using cookies holding encrypted data.
	// Thus, presence for a cookie with the "-aes" suffix is checked and it's assumed no active session
	// if such cookie is not found in the request.
	authCookie, err := r.Cookie(cookieName)
	if err != nil {
		return nil, fmt.Errorf("unable to read the cookie %s: %w", cookieName, err)
	}

	// Initially, take the value of the "-aes" cookie as the session data.
	// This helps a smoother transition from a previous version of Kiali where
	// no support for multiple cookies existed and no "-chunks" cookie was set.
	// With this, we tolerate the absence of the "-chunks" cookie to not force
	// users to re-authenticate if somebody was already logged into Kiali.
	base64SessionData := authCookie.Value

	// Check if session data is broken in chunks. If it is, read all chunks
	numChunksCookie, chunksCookieErr := r.Cookie(NumberOfChunksCookieName)
	if chunksCookieErr == nil {
		numChunks, convErr := strconv.Atoi(numChunksCookie.Value)
		if convErr != nil {
			return nil, fmt.Errorf("unable to read the chunks cookie: %w", convErr)
		}

		// It's known that major browsers have a limit of 180 cookies per domain.
		if numChunks <= 0 || numChunks > 180 {
			return nil, fmt.Errorf("number of session cookies is %d, but limit is 1 through 180", numChunks)
		}

		// Read session data chunks and save into a buffer
		var sessionDataBuffer strings.Builder
		sessionDataBuffer.Grow(numChunks * SessionCookieMaxSize)
		sessionDataBuffer.WriteString(base64SessionData)

		for i := 1; i < numChunks; i++ {
			authChunkCookie, chunkErr := r.Cookie(sessionCookieChunkName(cookieName, i))
			if chunkErr != nil {
				return nil, fmt.Errorf("failed to read session cookie chunk number %d: %w", i, chunkErr)
			}

			sessionDataBuffer.WriteString(authChunkCookie.Value)
		}

		// Get the concatenated session data
		base64SessionData = sessionDataBuffer.String()
	} else if chunksCookieErr != http.ErrNoCookie {
		// Tolerate a "no cookie" error, but if error is something else, throw up the error.
		return nil, fmt.Errorf("failed to read the chunks cookie: %w", chunksCookieErr)
	}

	// Persisted data has been read, but it's base64 encoded and it's also encrypted (per
	// the process in CreateSession function). Reverse the encoding and, then, decrypt the data.
	cipherSessionData, err := base64.StdEncoding.DecodeString(base64SessionData)
	if err != nil {
		// Older cookie specs don't allow "=", so it may get trimmed out.  If the std encoding
		// doesn't work, try raw encoding (with no padding).  If it still fails, error out
		cipherSessionData, err = base64.RawStdEncoding.DecodeString(base64SessionData)
		if err != nil {
			return nil, fmt.Errorf("unable to decode session data: %w", err)
		}
	}

	nonceSize := p.aesGCM.NonceSize()
	// Handle where cipherSessionData does not match nonceSize
	if len(cipherSessionData) < nonceSize {
		return nil, fmt.Errorf("unable to decrypt session")
	}
	nonce, cipherSessionData := cipherSessionData[:nonceSize], cipherSessionData[nonceSize:]

	sessionDataJson, err := p.aesGCM.Open(nil, nonce, cipherSessionData, nil)
	if err != nil {
		return nil, fmt.Errorf("error when restoring the session - failed to decrypt: %w", err)
	}

	var sData SessionData[T]
	err = json.Unmarshal(sessionDataJson, &sData)
	if err != nil {
		return nil, fmt.Errorf("error when restoring the session - failed to parse the session data: %w", err)
	}

	return &sData, nil
}

// ReadSession restores (decrypts) and returns the data that was persisted when using the CreateSession function.
// If a payload is provided, the original data is parsed and stored in the payload argument. As part of restoring
// the session, validation of expiration time is performed and no data is returned assuming the session is stale.
// Also, it is verified that the currently configured authentication strategy is the same as when the session was
// created.
func (p *cookieSessionPersistor[T]) ReadSession(r *http.Request, w http.ResponseWriter, key string) (*SessionData[T], error) {
	// This CookieSessionPersistor only deals with sessions using cookies holding encrypted data.
	// Thus, presence for a cookie with the "-aes" suffix is checked and it's assumed no active session
	// if such cookie is not found in the request.
	cookieName := sessionCookieName(SessionCookieName, key)
	sData, err := p.readKialiCookie(cookieName, r)
	if err != nil {
		if errors.Is(err, http.ErrNoCookie) {
			return nil, fmt.Errorf("session %w: cookie %s does not exist in request", ErrSessionNotFound, cookieName)
		}
		return nil, err
	}

	// Check that the currently configured strategy matches the strategy set in the session.
	// This is to prevent taking a session as valid if somebody re-configured Kiali with a different auth strategy.
	if sData.Strategy != p.conf.Auth.Strategy {
		log.Debugf("Session is invalid because it was created with authentication strategy %s, but current authentication strategy is %s", sData.Strategy, p.conf.Auth.Strategy)
		p.TerminateSession(r, w, key) // Kill the spurious session

		return nil, fmt.Errorf("session strategy %s does not match current strategy %s", sData.Strategy, p.conf.Auth.Strategy)
	}

	// Check that the session has not expired.
	// This is just a sanity check, because browser cookies are set to expire at this date and the browser
	// shouldn't send expired cookies.
	if !util.Clock.Now().Before(sData.ExpiresOn) {
		log.Debugf("Session is invalid because it expired on %s", sData.ExpiresOn.Format(time.RFC822))
		p.TerminateSession(r, w, key) // Clean the expired session

		return nil, fmt.Errorf("session expired on %s", sData.ExpiresOn.Format(time.RFC822))
	}

	return sData, nil
}

// ReadAllSessions reads all session cookies from the request and returns the session data.
// Returns an ErrNotFound if no session cookies are found.
func (p *cookieSessionPersistor[T]) ReadAllSessions(r *http.Request, w http.ResponseWriter) ([]*SessionData[T], error) {
	var sessions []*SessionData[T]
	for _, cookie := range r.Cookies() {
		// Don't read nonce cookies. These are not managed by this persistor.
		if (strings.HasPrefix(cookie.Name, SessionCookieName) || strings.HasPrefix(cookie.Name, NumberOfChunksCookieName)) && !strings.HasPrefix(cookie.Name, NonceCookieName) {
			log.Debugf("Reading session cookie: %s", cookie.Name)
			sData, err := p.readKialiCookie(cookie.Name, r)
			if err != nil {
				if err == http.ErrNoCookie {
					log.Debugf("Session cookie %s does not exist in request", cookie.Name)
				} else {
					log.Infof("Error reading session cookie %s: %v", cookie.Name, err)
					// If we can't read the cookie we should just drop it because it's probably malformed.
					p.dropCookie(r, w, cookie.Name)
				}
				continue
			}
			sessions = append(sessions, sData)
		}
	}

	if len(sessions) == 0 {
		return nil, fmt.Errorf("sessions %w: no session cookies were found in request", ErrSessionNotFound)
	}

	return sessions, nil
}

func (p *cookieSessionPersistor[T]) dropCookie(r *http.Request, w http.ResponseWriter, cookieName string) {
	log.Debugf("Dropping cookie: %s", cookieName)
	secureFlag := p.conf.IsServerHTTPS() || strings.HasPrefix(httputil.GuessKialiURL(p.conf, r), "https:")

	dropCookie := http.Cookie{
		Name:     cookieName,
		Value:    "",
		Expires:  time.Unix(0, 0),
		HttpOnly: true,
		Secure:   secureFlag,
		MaxAge:   -1,
		Path:     p.conf.Server.WebRoot,
		SameSite: http.SameSiteStrictMode,
	}
	http.SetCookie(w, &dropCookie)
}

// TerminateSession destroys any persisted data of a session created by the CreateSession function.
// The session is terminated unconditionally (that is, there is no validation of the session), allowing
// clearing any stale cookies/session.
func (p *cookieSessionPersistor[T]) TerminateSession(r *http.Request, w http.ResponseWriter, key string) {
	for _, cookie := range r.Cookies() {
		// Drop all cookies that are related to the session:
		// - Session cookie
		// - Number of chunks cookie
		// - Cookie chunks - mmmmmm
		// Don't drop nonce cookies because these are not saved inside the persistor. They are handled inside of the auth controllers.
		if (strings.HasPrefix(cookie.Name, sessionCookieName(SessionCookieName, key)) || cookie.Name == sessionCookieName(NumberOfChunksCookieName, key)) && !strings.Contains(cookie.Name, "nonce") {
			p.dropCookie(r, w, cookie.Name)
		}
	}
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
