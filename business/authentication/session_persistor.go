package authentication

import (
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"github.com/kiali/kiali/log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/util"
)

type SessionPersistor interface {
	CreateSession(r *http.Request, w http.ResponseWriter, strategy string, expiresOn time.Time, payload interface{}) error
	ReadSession(r *http.Request, w http.ResponseWriter) (payload interface{}, err error)
	TerminateSession(w http.ResponseWriter, r *http.Request)
}

type sessionData struct {
	Strategy  string      `json:"strategy"`
	ExpiresOn time.Time   `json:"expiresOn"`
	Payload   interface{} `json:"payload,omitempty"`
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

type CookieSessionPersistor struct{}

// Create Kiali's session cookie and set it in the response
func (p CookieSessionPersistor) CreateSession(r *http.Request, w http.ResponseWriter, strategy string, expiresOn time.Time, payload interface{}) error {
	sData := sessionData{
		Strategy:  strategy,
		ExpiresOn: expiresOn,
		Payload:   payload,
	}

	sDataJson, err := json.Marshal(sData)
	if err != nil {
		return fmt.Errorf("error when creating the session - failed to marshal json: %w", err)
	}

	// Cipher the session data and encode to base64
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

	// If the resulting session data is large, it may not fit in one cookie. So, the resulting
	// session data is broken in chunks and multiple cookies are used, as is needed.
	conf := config.Get()

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
			Expires:  expiresOn,
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
			Expires:  expiresOn,
			HttpOnly: true,
			Path:     conf.Server.WebRoot,
			SameSite: http.SameSiteStrictMode,
		}
		http.SetCookie(w, &chunksCookie)
	}

	return nil

	// For the OpenId's "authorization code" flow we don't want
	// any of the session data to be readable even in the browser's
	// developer console. So, we cipher the session data using AES-GCM
	// which allows to leave aside the usage of JWT tokens. So, this
	// builds a bare JSON serialized into a string, cipher it and
	// set a cookie with the ciphered string. Yet, we use the
	// "IanaClaims" type just for convenience to avoid creating new types and
	// to bring some type convergence on types for the auth source code.
	//
	//sessionData := business.BuildOpenIdJwtClaims(openIdParams, useAccessToken)
	//sessionDataJson, err := json.Marshal(sessionData)
	//if err != nil {
	//	msg := fmt.Sprintf("Error when creating credentials - failed to marshal json: %s", err.Error())
	//	log.Error(msg)
	//	http.Redirect(w, r, fmt.Sprintf("%s?openid_error=%s", webRootWithSlash, url.QueryEscape(msg)), http.StatusFound)
	//	return true
	//}
	//
	// Cipher the session data and encode to base64
	//block, err := aes.NewCipher([]byte(config.GetSigningKey()))
	//if err != nil {
	//	msg := fmt.Sprintf("Error when creating credentials - failed to create cipher: %s", err.Error())
	//	log.Error(msg)
	//	http.Redirect(w, r, fmt.Sprintf("%s?openid_error=%s", webRootWithSlash, url.QueryEscape(msg)), http.StatusFound)
	//	return true
	//}
	//
	//aesGcm, err := cipher.NewGCM(block)
	//if err != nil {
	//	msg := fmt.Sprintf("Error when creating credentials - failed to create gcm: %s", err.Error())
	//	log.Error(msg)
	//	http.Redirect(w, r, fmt.Sprintf("%s?openid_error=%s", webRootWithSlash, url.QueryEscape(msg)), http.StatusFound)
	//	return true
	//}
	//
	//aesGcmNonce, err := util.CryptoRandomBytes(aesGcm.NonceSize())
	//if err != nil {
	//	msg := fmt.Sprintf("Error when creating credentials - failed to generate random bytes: %s", err.Error())
	//	log.Error(msg)
	//	http.Redirect(w, r, fmt.Sprintf("%s?openid_error=%s", webRootWithSlash, url.QueryEscape(msg)), http.StatusFound)
	//	return true
	//}
	//
	//cipherSessionData := aesGcm.Seal(aesGcmNonce, aesGcmNonce, sessionDataJson, nil)
	//base64SessionData := base64.StdEncoding.EncodeToString(cipherSessionData)
	//
	//// If resulting session data is large, it may not fit in one cookie. So, the resulting
	//// session data is broken in chunks and multiple cookies are used, as is needed.
	//sessionDataChunks := chunkString(base64SessionData, business.SessionCookieMaxSize)
	//for i, chunk := range sessionDataChunks {
	//	var cookieName string
	//	if i == 0 {
	//		// Set a cookie with the regular cookie name with the first chunk of session data.
	//		// This is for backwards compatibility
	//		cookieName = config.TokenCookieName + "-aes"
	//	} else {
	//		// If there are more chunks of session data (usually because of larger tokens from the IdP),
	//		// store the remainder data to numbered cookies.
	//		cookieName = fmt.Sprintf("%s-aes-%d", config.TokenCookieName, i)
	//	}
	//
	//	authCookie := http.Cookie{
	//		Name:     cookieName,
	//		Value:    chunk,
	//		Expires:  openIdParams.ExpiresOn,
	//		HttpOnly: true,
	//		Path:     conf.Server.WebRoot,
	//		SameSite: http.SameSiteStrictMode,
	//	}
	//	http.SetCookie(w, &authCookie)
	//}
	//
	//if len(sessionDataChunks) > 1 {
	//	// Set a cookie with the number of chunks of the session data.
	//	// This is to protect against reading spurious chunks of data if there is
	//	// any failure when killing the session or logging out.
	//	chunksCookie := http.Cookie{
	//		Name:     config.TokenCookieName + "-chunks",
	//		Value:    strconv.Itoa(len(sessionDataChunks)),
	//		Expires:  openIdParams.ExpiresOn,
	//		HttpOnly: true,
	//		Path:     conf.Server.WebRoot,
	//		SameSite: http.SameSiteStrictMode,
	//	}
	//	http.SetCookie(w, &chunksCookie)
	//}
}

func (p CookieSessionPersistor) ReadSession(r *http.Request, w http.ResponseWriter) (interface{}, error) {
	authCookie, err := r.Cookie(config.TokenCookieName + "-aes")
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
		sessionDataBuffer.Grow(numChunks * business.SessionCookieMaxSize)
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

	cipherSessionData, err := base64.StdEncoding.DecodeString(base64SessionData)
	if err != nil {
		return nil, fmt.Errorf("unable to decode session data: %w", err)
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

	var sData sessionData
	err = json.Unmarshal(sessionDataJson, &sData)
	if err != nil {
		return nil, fmt.Errorf("error when restoring the session - failed to parse the session data: %w", err)
	}

	if sData.Strategy != config.Get().Auth.Strategy {
		log.Tracef("Session is invalid because it was created with authentication strategy %s, but current authentication strategy is %s", sData.Strategy, config.Get().Auth.Strategy)
		p.TerminateSession(r, w) // Kill the spurious session

		return nil, nil
	}

	if !util.Clock.Now().Before(sData.ExpiresOn) {
		log.Tracef("Session is invalid because it expired on %s", sData.ExpiresOn.Format(time.RFC822))
		p.TerminateSession(r, w) // Clean the expired session

		return nil, nil
	}

	return sData.Payload, nil
}

func (p CookieSessionPersistor) TerminateSession(r *http.Request, w http.ResponseWriter) {
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
