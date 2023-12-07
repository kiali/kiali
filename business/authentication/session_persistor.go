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

type SessionPersistor interface {
	CreateSession(r *http.Request, w http.ResponseWriter, strategy string, expiresOn time.Time, payload interface{}) error
	ReadSession(r *http.Request, w http.ResponseWriter, payload interface{}) (sData *sessionData, err error)
	TerminateSession(r *http.Request, w http.ResponseWriter)
}

const (
	AESSessionCookieName       = config.TokenCookieName + "-aes"
	AESSessionChunksCookieName = config.TokenCookieName + "-chunks"
)

// CookieSessionPersistor is a session storage based on browser cookies. Session
// persistence is achieved by storing all session data in browser cookies. Only
// client-side storage is used and no back-end storage is needed.
// Browser cookies have size constraints and the workaround for large session data/payload
// is using multiple cookies. There is still a (browser dependant) limit on the
// number of cookies that a website can set but we haven't heard of a user
// facing problems because of reaching this limit.
type CookieSessionPersistor struct{}

type sessionData struct {
	Strategy  string    `json:"strategy"`
	ExpiresOn time.Time `json:"expiresOn"`
	Payload   string    `json:"payload,omitempty"`
}

// CreateSession starts a user session using HTTP Cookies for persistance across HTTP requests.
// For improved security, the data of the session is encrypted using the AES-GCM algorithm and
// the encrypted data is what is sent in cookies. The strategy, expiresOn and payload arguments
// are all required.
func (p CookieSessionPersistor) CreateSession(r *http.Request, w http.ResponseWriter, strategy string, expiresOn time.Time, payload interface{}) error {
	// Validate that there is a payload and a strategy. The strategy is required just in case Kiali is reconfigured with a
	// different strategy and drop any stale session. The payload is required because it does not make sense to start a session
	// if there is no data to persist.
	if payload == nil || len(strategy) == 0 {
		return errors.New("a session cannot be created without strategy, or with a nil payload")
	}

	// Reject expiration time that is already in the past.
	if !util.Clock.Now().Before(expiresOn) {
		return errors.New("the expiration time of a session cannot be in the past")
	}

	// Serialize the payload. The resulting string will be re-serialized along some metadata.
	// It may not sound very efficient to serialize twice (the sessionData struct may declare
	//  its Payload field as interface{}). However, this allows de-serialization
	// to the original type in the ReadSession function, rather than manually parsing a generic map[string]interface{}.
	// Read more in the ReadSession function.
	payloadMarshalled, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("error when creating the session - failed to marshal payload: %w", err)
	}

	// Add some metadata to the session and serialize this structure. The resulting string
	// is what will be encrypted and stored in cookies.
	sData := sessionData{
		Strategy:  strategy,
		ExpiresOn: expiresOn,
		Payload:   string(payloadMarshalled),
	}

	sDataJson, err := json.Marshal(sData)
	if err != nil {
		return fmt.Errorf("error when creating the session - failed to marshal JSON: %w", err)
	}

	// The sDataJson string holds the session data that we want to persist.
	// It's time to encrypt this data which will result in an illegible sequence of bytes which are then
	// encoded to base64 get a string that is suitable to store in browser cookies.
	block, err := aes.NewCipher([]byte(config.GetSigningKey()))
	if err != nil {
		return fmt.Errorf("error when creating the session - failed to create cipher: %w", err)
	}

	aesGcm, err := cipher.NewGCM(block)
	if err != nil {
		return fmt.Errorf("error when creating credentials - failed to create gcm: %w", err)
	}

	aesGcmNonce, err := util.CryptoRandomBytes(aesGcm.NonceSize())
	if err != nil {
		return fmt.Errorf("error when creating credentials - failed to generate random bytes: %w", err)
	}

	cipherSessionData := aesGcm.Seal(aesGcmNonce, aesGcmNonce, sDataJson, nil)
	base64SessionData := base64.StdEncoding.EncodeToString(cipherSessionData)

	// The base64SessionData holds what we want to store in browser cookies.
	// It's time to set/send the browser cookies to persist the session.

	// If the resulting session data is large, it may not fit in one cookie. So, the resulting
	// session data is broken in chunks and multiple cookies are used, as is needed.
	conf := config.Get()
	secureFlag := conf.IsServerHTTPS() || strings.HasPrefix(httputil.GuessKialiURL(r), "https:")

	sessionDataChunks := chunkString(base64SessionData, SessionCookieMaxSize)
	for i, chunk := range sessionDataChunks {
		var cookieName string
		if i == 0 {
			// Set a cookie with the regular cookie name with the first chunk of session data.
			// Notice that an "-aes" suffix is being used in the cookie names. This is for backwards compatibility and
			// is/was meant to be able to differentiate between a session using cookies holding encrypted data, and the older
			// less secure sessions using cookies holding JWTs.
			cookieName = AESSessionCookieName
		} else {
			// If there are more chunks of session data (usually because of larger tokens from the IdP),
			// store the remainder data to numbered cookies.
			cookieName = fmt.Sprintf("%s-aes-%d", config.TokenCookieName, i)
		}

		authCookie := http.Cookie{
			Name:     cookieName,
			Value:    chunk,
			Expires:  expiresOn,
			HttpOnly: true,
			Secure:   secureFlag,
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
			Name:     AESSessionChunksCookieName,
			Value:    strconv.Itoa(len(sessionDataChunks)),
			Expires:  expiresOn,
			HttpOnly: true,
			Secure:   secureFlag,
			Path:     conf.Server.WebRoot,
			SameSite: http.SameSiteStrictMode,
		}
		http.SetCookie(w, &chunksCookie)
	}

	return nil
}

// ReadSession restores (decrypts) and returns the data that was persisted when using the CreateSession function.
// If a payload is provided, the original data is parsed and stored in the payload argument. As part of restoring
// the session, validation of expiration time is performed and no data is returned assuming the session is stale.
// Also, it is verified that the currently configured authentication strategy is the same as when the session was
// created.
func (p CookieSessionPersistor) ReadSession(r *http.Request, w http.ResponseWriter, payload interface{}) (*sessionData, error) {
	// This CookieSessionPersistor only deals with sessions using cookies holding encrypted data.
	// Thus, presence for a cookie with the "-aes" suffix is checked and it's assumed no active session
	// if such cookie is not found in the request.
	authCookie, err := r.Cookie(AESSessionCookieName)
	if err != nil {
		if err == http.ErrNoCookie {
			log.Tracef("The AES cookie is missing.")
			return nil, nil
		}
		return nil, fmt.Errorf("unable to read the -aes cookie: %w", err)
	}

	// Initially, take the value of the "-aes" cookie as the session data.
	// This helps a smoother transition from a previous version of Kiali where
	// no support for multiple cookies existed and no "-chunks" cookie was set.
	// With this, we tolerate the absence of the "-chunks" cookie to not force
	// users to re-authenticate if somebody was already logged into Kiali.
	base64SessionData := authCookie.Value

	// Check if session data is broken in chunks. If it is, read all chunks
	numChunksCookie, chunksCookieErr := r.Cookie(config.TokenCookieName + "-chunks")
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
			cookieName := fmt.Sprintf("%s-aes-%d", config.TokenCookieName, i)
			authChunkCookie, chunkErr := r.Cookie(cookieName)
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

	block, err := aes.NewCipher([]byte(config.GetSigningKey()))
	if err != nil {
		return nil, fmt.Errorf("error when restoring the session - failed to create the cipher: %w", err)
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("error when restoring the session - failed to create gcm: %w", err)
	}

	nonceSize := aesGCM.NonceSize()
	nonce, cipherSessionData := cipherSessionData[:nonceSize], cipherSessionData[nonceSize:]

	sessionDataJson, err := aesGCM.Open(nil, nonce, cipherSessionData, nil)
	if err != nil {
		return nil, fmt.Errorf("error when restoring the session - failed to decrypt: %w", err)
	}

	// sessionDataJson is holding the decrypted data as a string. This should be a JSON document. Let's parse it.
	var sData sessionData
	err = json.Unmarshal(sessionDataJson, &sData)
	if err != nil {
		return nil, fmt.Errorf("error when restoring the session - failed to parse the session data: %w", err)
	}

	// Check that the currently configured strategy matches the strategy set in the session.
	// This is to prevent taking a session as valid if somebody re-configured Kiali with a different auth strategy.
	if sData.Strategy != config.Get().Auth.Strategy {
		log.Tracef("Session is invalid because it was created with authentication strategy %s, but current authentication strategy is %s", sData.Strategy, config.Get().Auth.Strategy)
		p.TerminateSession(r, w) // Kill the spurious session

		return nil, nil
	}

	// Check that the session has not expired.
	// This is just a sanity check, because browser cookies are set to expire at this date and the browser
	// shouldn't send expired cookies.
	if !util.Clock.Now().Before(sData.ExpiresOn) {
		log.Tracef("Session is invalid because it expired on %s", sData.ExpiresOn.Format(time.RFC822))
		p.TerminateSession(r, w) // Clean the expired session

		return nil, nil
	}

	// The Payload field of the parsed JSON contains yet another JSON document. This is where we see the advantage
	// of the double serialization of the payload. Here in ReadSession we are receiving a payload argument. If the caller
	// passes an object with the original type of the payload that was passed to CreateSession, we can let the json
	// library to parse and set the data in the payload variable/argument, removing the need to deal with a
	// Payload typed as map[string]interface{}.
	if payload != nil {
		payloadErr := json.Unmarshal([]byte(sData.Payload), payload)
		if payloadErr != nil {
			return nil, fmt.Errorf("error when restoring the session - failed to parse the session payload: %w", payloadErr)
		}
	}

	return &sData, nil
}

// TerminateSession destroys any persisted data of a session created by the CreateSession function.
// The session is terminated unconditionally (that is, there is no validation of the session), allowing
// clearing any stale cookies/session.
func (p CookieSessionPersistor) TerminateSession(r *http.Request, w http.ResponseWriter) {
	conf := config.Get()
	secureFlag := conf.IsServerHTTPS() || strings.HasPrefix(httputil.GuessKialiURL(r), "https:")

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
				Secure:   secureFlag,
				MaxAge:   -1,
				Path:     conf.Server.WebRoot,
				SameSite: http.SameSiteStrictMode,
			}
			http.SetCookie(w, &tokenCookie)
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
