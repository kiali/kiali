package business

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/sha256"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/dgrijalva/jwt-go"
	"golang.org/x/sync/singleflight"
	"gopkg.in/square/go-jose.v2"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util"
)

const (
	OpenIdNonceCookieName = config.TokenCookieName + "-openid-nonce"

	// Maximum size of session cookies. This is 3.5K.
	// Major browsers limit cookie size to 4K, but this includes
	// metadata like expiration date, the cookie name, etc. So
	// use 3.5K for cookie data and leave 0.5K for metadata.
	SessionCookieMaxSize = 3584
)

type OpenIdMetadata struct {
	// Taken from https://github.com/coreos/go-oidc/blob/8d771559cf6e5111c9b9159810d0e4538e7cdc82/oidc.go
	Issuer      string   `json:"issuer"`
	AuthURL     string   `json:"authorization_endpoint"`
	TokenURL    string   `json:"token_endpoint"`
	JWKSURL     string   `json:"jwks_uri"`
	UserInfoURL string   `json:"userinfo_endpoint"`
	Algorithms  []string `json:"id_token_signing_alg_values_supported"`

	// Some extra fields
	ScopesSupported        []string `json:"scopes_supported"`
	ResponseTypesSupported []string `json:"response_types_supported"`
}

type OpenIdCallbackParams struct {
	AccessToken   string
	Code          string
	ExpiresOn     time.Time
	IdToken       string
	Nonce         string
	NonceHash     []byte
	ParsedIdToken *jwt.Token
	State         string
	Subject       string
}

var cachedOpenIdKeySet *jose.JSONWebKeySet
var cachedOpenIdMetadata *OpenIdMetadata
var openIdFlightGroup singleflight.Group

func BuildOpenIdJwtClaims(openIdParams *OpenIdCallbackParams, useAccessToken bool) *config.IanaClaims {
	sessionId := openIdParams.IdToken
	if useAccessToken {
		sessionId = openIdParams.AccessToken
	}

	return &config.IanaClaims{
		SessionId: sessionId,
		StandardClaims: jwt.StandardClaims{
			Subject:   openIdParams.Subject,
			ExpiresAt: openIdParams.ExpiresOn.Unix(),
			Issuer:    config.AuthStrategyOpenIdIssuer,
		},
	}
}

func CallbackCleanup(w http.ResponseWriter) {
	// Delete the nonce cookie since we no longer need it.
	deleteNonceCookie := http.Cookie{
		Name:     OpenIdNonceCookieName,
		Expires:  time.Unix(0, 0),
		HttpOnly: true,
		Path:     config.Get().Server.WebRoot,
		SameSite: http.SameSiteStrictMode,
		Value:    "",
	}
	http.SetCookie(w, &deleteNonceCookie)
}

func ExtractOpenIdCallbackParams(r *http.Request) (params *OpenIdCallbackParams, err error) {
	params = &OpenIdCallbackParams{}

	// Get the nonce code hash
	var nonceCookie *http.Cookie
	if nonceCookie, err = r.Cookie(OpenIdNonceCookieName); err == nil {
		params.Nonce = nonceCookie.Value

		hash := sha256.Sum224([]byte(nonceCookie.Value))
		params.NonceHash = make([]byte, sha256.Size224)
		copy(params.NonceHash, hash[:])
	}

	// Parse/fetch received form data
	err = r.ParseForm()
	if err != nil {
		err = fmt.Errorf("error parsing form info: %w", err)
	} else {
		// Read relevant form data parameters
		params.Code = r.Form.Get("code")
		params.IdToken = r.Form.Get("id_token")
		params.State = r.Form.Get("state")
	}

	return
}

func CheckOpenIdImplicitFlowParams(params *OpenIdCallbackParams) string {
	if params.NonceHash == nil {
		return "No nonce code present. Login window timed out."
	}
	if params.State == "" {
		return "State parameter is empty or invalid."
	}
	if params.IdToken == "" {
		return "Token is empty or invalid."
	}

	return ""
}

func CheckOpenIdAuthorizationCodeFlowParams(params *OpenIdCallbackParams) string {
	if params.NonceHash == nil {
		return "No nonce code present. Login window timed out."
	}
	if params.State == "" {
		return "State parameter is empty or invalid."
	}
	if params.Code == "" {
		return "No authorization code is present."
	}

	return ""
}

func ParseOpenIdToken(openIdParams *OpenIdCallbackParams) error {
	// Parse the received id_token from the IdP
	parsedIdToken, _, err := new(jwt.Parser).ParseUnverified(openIdParams.IdToken, jwt.MapClaims{})
	if err != nil {
		return fmt.Errorf("cannot parse received id_token from the OpenId provider: %w", err)
	}
	openIdParams.ParsedIdToken = parsedIdToken
	idTokenClaims := parsedIdToken.Claims.(jwt.MapClaims)

	// Set a default value for expiration date
	if expClaim, ok := idTokenClaims["exp"]; !ok {
		return errors.New("the received id_token from the OpenId provider has missing the required 'exp' claim")
	} else {
		// If the expiration date is present on the claim, we use that
		expiresInNumber, err := parseTimeClaim(expClaim)
		if err != nil {
			return fmt.Errorf("token exp claim is present, but invalid: %w", err)
		}

		openIdParams.ExpiresOn = time.Unix(expiresInNumber, 0)
	}

	// Extract the name of the user from the id_token. The "subject" is passed to the front-end to be displayed.
	openIdParams.Subject = "OpenId User" // Set a default value
	if userClaim, ok := idTokenClaims[config.Get().Auth.OpenId.UsernameClaim]; ok && len(userClaim.(string)) > 0 {
		openIdParams.Subject = userClaim.(string)
	}

	return nil
}

// GetConfiguredOpenIdScopes gets the list of scopes set in Kiali configuration making sure
// that the mandatory "openid" scope is present in the returned list.
func GetConfiguredOpenIdScopes() []string {
	cfg := config.Get().Auth.OpenId
	scopes := cfg.Scopes

	isOpenIdScopePresent := false
	for _, s := range scopes {
		if s == "openid" {
			isOpenIdScopePresent = true
			break
		}
	}

	if !isOpenIdScopePresent {
		scopes = append(scopes, "openid")
	}

	return scopes
}

func GetJwkFromKeySet(keyId string) (*jose.JSONWebKey, error) {
	// Helper function to find a key with a certain key id in a key-set.
	var findJwkFunc = func(kid string, jwks *jose.JSONWebKeySet) *jose.JSONWebKey {
		for _, key := range jwks.Keys {
			if key.KeyID == kid {
				return &key
			}
		}
		return nil
	}

	if cachedOpenIdKeySet != nil {
		// If key-set is cached, try to find the key in the cached key-set
		foundKey := findJwkFunc(keyId, cachedOpenIdKeySet)
		if foundKey != nil {
			return foundKey, nil
		}
	}

	// If key-set is not cached, or if the requested key was not found in the
	// cached key-set, then fetch/refresh the key-set from the OpenId provider
	keySet, err := GetOpenIdJwks()
	if err != nil {
		return nil, err
	}

	// Try to find the key in the fetched key-set
	foundKey := findJwkFunc(keyId, keySet)

	// "foundKey" can be nil. That's acceptable if the key-set does not contain the requested key id
	return foundKey, nil
}

func GetOpenIdAesSession(r *http.Request) (*config.IanaClaims, error) {
	authCookie, err := r.Cookie(config.TokenCookieName + "-aes")
	if err != nil {
		if err == http.ErrNoCookie {
			log.Debugf("The AES cookie is mising.")
			return nil, nil
		}
		return nil, err
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
			return nil, convErr
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
				return nil, chunkErr
			}

			sessionDataBuffer.WriteString(authChunkCookie.Value)
		}

		// Get the concatenated session data
		base64SessionData = sessionDataBuffer.String()
	} else if chunksCookieErr != http.ErrNoCookie {
		// Tolerate a "no cookie" error, but if error is something else, throw up the error.
		return nil, chunksCookieErr
	}

	cipherSessionData, err := base64.StdEncoding.DecodeString(base64SessionData)
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher([]byte(config.GetSigningKey()))
	if err != nil {
		return nil, err
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonceSize := aesGCM.NonceSize()
	nonce, cipherSessionData := cipherSessionData[:nonceSize], cipherSessionData[nonceSize:]

	sessionDataJson, err := aesGCM.Open(nil, nonce, cipherSessionData, nil)
	if err != nil {
		return nil, err
	}

	var sessionData config.IanaClaims
	err = json.Unmarshal(sessionDataJson, &sessionData)
	if err != nil {
		return nil, err
	}

	return &sessionData, nil
}

func getProxyForUrl(targetURL *url.URL, httpProxy string, httpsProxy string) func(req *http.Request) (*url.URL, error) {
	return func(req *http.Request) (*url.URL, error) {
		var proxyUrl *url.URL
		var err error

		if httpProxy != "" && targetURL.Scheme == "http" {
			proxyUrl, err = url.Parse(httpProxy)
		} else if httpsProxy != "" && targetURL.Scheme == "https" {
			proxyUrl, err = url.Parse(httpsProxy)
		}

		if err != nil {
			return nil, err
		}

		return proxyUrl, nil
	}
}

// GetOpenIdMetadata fetches the OpenId metadata using the configured Issuer URI and
// downloading the metadata from the well-known path '/.well-known/openid-configuration'. Some
// validations are performed and the parsed metadata is returned. Since the metadata should be
// rare to change, the retrieved metadata is cached on first call and subsequent calls return
// the cached metadata.
func GetOpenIdMetadata() (*OpenIdMetadata, error) {
	if cachedOpenIdMetadata != nil {
		return cachedOpenIdMetadata, nil
	}

	fetchedMetadata, fetchError, _ := openIdFlightGroup.Do("metadata", func() (interface{}, error) {
		cfg := config.Get().Auth.OpenId

		// Remove trailing slash from issuer URI, if needed
		trimmedIssuerUri := strings.TrimRight(cfg.IssuerUri, "/")

		httpClient, err := createHttpClient(trimmedIssuerUri)
		if err != nil {
			return nil, fmt.Errorf("failed to create http client to fetch OpenId Metadata: %w", err)
		}

		// Fetch IdP metadata
		response, err := httpClient.Get(trimmedIssuerUri + "/.well-known/openid-configuration")
		if err != nil {
			return nil, err
		}

		defer response.Body.Close()
		if response.StatusCode != 200 {
			return nil, fmt.Errorf("cannot fetch OpenId Metadata (HTTP response status = %s)", response.Status)
		}

		// Parse JSON document
		var metadata OpenIdMetadata

		rawMetadata, err := ioutil.ReadAll(response.Body)
		if err != nil {
			return nil, fmt.Errorf("failed to read OpenId Metadata: %s", err.Error())
		}

		err = json.Unmarshal(rawMetadata, &metadata)
		if err != nil {
			return nil, fmt.Errorf("cannot parse OpenId Metadata: %s", err.Error())
		}

		// Validate issuer == issuerUri
		if metadata.Issuer != cfg.IssuerUri {
			return nil, fmt.Errorf("mismatch between the configured issuer_uri (%s) and the exposed Issuer URI in OpenId provider metadata (%s)", cfg.IssuerUri, metadata.Issuer)
		}

		// Validate there is an authorization endpoint
		if len(metadata.AuthURL) == 0 {
			return nil, errors.New("the OpenID provider does not expose an authorization endpoint")
		}

		// Log warning if OpenId provider Metadata does not expose "id_token" in it's supported response types.
		// It's possible to try authentication. If metadata is right, the error will be evident to the user when trying to login.
		responseTypes := strings.Join(metadata.ResponseTypesSupported, " ")
		if !strings.Contains(responseTypes, "id_token") {
			log.Warning("Configured OpenID provider informs response_type=id_token is unsupported. Users may not be able to login.")
		}

		// Log warning if OpenId provider informs that some of the configured scopes are not supported
		// It's possible to try authentication. If metadata is right, the error will be evident to the user when trying to login.
		scopes := GetConfiguredOpenIdScopes()
		for _, scope := range scopes {
			isScopeSupported := false
			for _, supportedScope := range metadata.ScopesSupported {
				if scope == supportedScope {
					isScopeSupported = true
					break
				}
			}

			if !isScopeSupported {
				log.Warning("Configured OpenID provider informs some of the configured scopes are unsupported. Users may not be able to login.")
				break
			}
		}

		// Return parsed metadata
		cachedOpenIdMetadata = &metadata
		return cachedOpenIdMetadata, nil
	})

	if fetchError != nil {
		return nil, fetchError
	}

	return fetchedMetadata.(*OpenIdMetadata), nil
}

func GetOpenIdJwks() (*jose.JSONWebKeySet, error) {
	fetchedKeySet, fetchError, _ := openIdFlightGroup.Do("jwks", func() (interface{}, error) {
		oidcMetadata, err := GetOpenIdMetadata()
		if err != nil {
			return nil, err
		}

		// Create HTTP client
		httpClient, err := createHttpClient(oidcMetadata.JWKSURL)
		if err != nil {
			return nil, fmt.Errorf("failed to create http client to fetch OpenId JWKS document: %w", err)
		}

		// Fetch Keys document
		response, err := httpClient.Get(oidcMetadata.JWKSURL)
		if err != nil {
			return nil, err
		}

		defer response.Body.Close()
		if response.StatusCode != 200 {
			return nil, fmt.Errorf("cannot fetch OpenId JWKS document (HTTP response status = %s)", response.Status)
		}

		// Parse the Keys document
		var oidcKeys jose.JSONWebKeySet

		rawMetadata, err := ioutil.ReadAll(response.Body)
		if err != nil {
			return nil, fmt.Errorf("failed to read OpenId JWKS document: %s", err.Error())
		}

		err = json.Unmarshal(rawMetadata, &oidcKeys)
		if err != nil {
			return nil, fmt.Errorf("cannot parse OpenId JWKS document: %s", err.Error())
		}

		cachedOpenIdKeySet = &oidcKeys // Store the keyset in a "cache"
		return cachedOpenIdKeySet, nil
	})

	if fetchError != nil {
		return nil, fetchError
	}

	return fetchedKeySet.(*jose.JSONWebKeySet), nil
}

func IsOpenIdCodeFlowPossible() bool {
	// Kiali's signing key length must be 16, 24 or 32 bytes in order to be able to use
	// encoded cookies.
	switch len(config.GetSigningKey()) {
	case 16, 24, 32:
	default:
		log.Warningf("Cannot use OpenId authorization code flow because signing key is not 16, 24 nor 32 bytes long")
		return false
	}

	// IdP provider's metadata must list "code" in it's supported response types
	metadata, err := GetOpenIdMetadata()
	if err != nil {
		// On error, just inform that code flow is not possible
		log.Warningf("Error when fetching OpenID provider's metadata: %s", err.Error())
		return false
	}

	for _, v := range metadata.ResponseTypesSupported {
		if v == "code" {
			return true
		}
	}

	return false
}

func RequestOpenIdToken(openIdParams *OpenIdCallbackParams, redirect_uri string) error {
	openIdMetadata, err := GetOpenIdMetadata()
	if err != nil {
		return err
	}

	cfg := config.Get().Auth.OpenId

	httpClient, err := createHttpClient(openIdMetadata.TokenURL)
	if err != nil {
		return fmt.Errorf("failure when creating http client to request open id token: %w", err)
	}

	// Exchange authorization code for a token
	requestParams := url.Values{}
	requestParams.Set("code", openIdParams.Code)
	requestParams.Set("grant_type", "authorization_code")
	requestParams.Set("redirect_uri", redirect_uri)
	if len(cfg.ClientSecret) == 0 {
		requestParams.Set("client_id", cfg.ClientId)
	}

	tokenRequest, err := http.NewRequest(http.MethodPost, openIdMetadata.TokenURL, strings.NewReader(requestParams.Encode()))
	if err != nil {
		return fmt.Errorf("failure when creating the token request: %w", err)
	}

	if len(cfg.ClientSecret) > 0 {
		tokenRequest.SetBasicAuth(url.QueryEscape(cfg.ClientId), url.QueryEscape(cfg.ClientSecret))
	}

	tokenRequest.Header.Add("Content-Type", "application/x-www-form-urlencoded")
	response, err := httpClient.Do(tokenRequest)
	if err != nil {
		return fmt.Errorf("failure when requesting token from IdP: %w", err)
	}

	defer response.Body.Close()
	rawTokenResponse, err := ioutil.ReadAll(response.Body)
	if err != nil {
		return fmt.Errorf("failed to read token response from IdP: %w", err)
	}

	if response.StatusCode != 200 {
		log.Debugf("OpenId token request failed with response: %s", string(rawTokenResponse))
		return fmt.Errorf("request failed (HTTP response status = %s)", response.Status)
	}

	// Parse token response
	var tokenResponse struct {
		IdToken     string `json:"id_token"`
		AccessToken string `json:"access_token"`
	}

	err = json.Unmarshal(rawTokenResponse, &tokenResponse)
	if err != nil {
		return fmt.Errorf("cannot parse OpenId token response: %w", err)
	}

	if len(tokenResponse.IdToken) == 0 {
		return errors.New("the IdP did not provide an id_token")
	}

	openIdParams.IdToken = tokenResponse.IdToken
	openIdParams.AccessToken = tokenResponse.AccessToken
	return nil
}

func ValidateOpenIdNonceCode(openIdParams *OpenIdCallbackParams) (validationFailure string) {
	// Parse the received id_token from the IdP and check nonce code
	idTokenClaims := openIdParams.ParsedIdToken.Claims.(jwt.MapClaims)
	nonceHashHex := fmt.Sprintf("%x", openIdParams.NonceHash)
	if nonceClaim, ok := idTokenClaims["nonce"]; !ok || nonceHashHex != nonceClaim.(string) {
		validationFailure = "nonce code mismatch"
	}
	return
}

// - CSRF mitigation
func ValidateOpenIdState(openIdParams *OpenIdCallbackParams) (validationFailure string) {
	state := openIdParams.State

	separator := strings.LastIndexByte(state, '-')
	if separator != -1 {
		csrfToken, timestamp := state[:separator], state[separator+1:]
		csrfHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", openIdParams.Nonce, timestamp, config.GetSigningKey())))

		if fmt.Sprintf("%x", csrfHash) != csrfToken {
			validationFailure = "CSRF mitigation"
		}
	} else {
		validationFailure = "State parameter is invalid"
	}

	return
}

func ValidateOpenTokenInHouse(openIdParams *OpenIdCallbackParams) error {
	oidCfg := config.Get().Auth.OpenId
	oidMetadata, err := GetOpenIdMetadata()
	if err != nil {
		return err
	}

	idTokenClaims := openIdParams.ParsedIdToken.Claims.(jwt.MapClaims)

	// Check iss claim matches fetched metadata at discovery
	if issuerClaim, ok := idTokenClaims["iss"].(string); !ok || issuerClaim != oidMetadata.Issuer {
		return fmt.Errorf("the OpenId token has unexpected issuer claim; got iss = '%s'", issuerClaim)
	}

	// Check the aud claim contains our client-id
	checkAzpClaim := false
	if audienceClaim, ok := idTokenClaims["aud"]; !ok {
		return errors.New("the OpenId token has no aud claim")
	} else {
		switch ac := audienceClaim.(type) {
		case string:
			if oidCfg.ClientId != ac {
				return fmt.Errorf("the OpenId token is not targeted for Kiali; got aud = '%s'", audienceClaim)
			}
		case []string:
			audFound := false
			for _, audItem := range ac {
				if oidCfg.ClientId == audItem {
					audFound = true
				}
			}
			if !audFound {
				return fmt.Errorf("the OpenId token is not targeted for Kiali; got aud = %v", audienceClaim)
			}

			// The OIDC Spec says that if the aud claim contains multiple audiences, we "SHOULD" check
			// the azp claim is present. In Kiali, there is currently no known reason to omit this
			// check, so we do it.
			checkAzpClaim = true
		default:
			return fmt.Errorf("the OpenId token has an unexpected audience claim; got '%v'", audienceClaim)
		}
	}

	if checkAzpClaim {
		// Check that the azp claim is present and contains our client_id
		if authorizedPartyClaim, ok := idTokenClaims["azp"].(string); !ok {
			return fmt.Errorf("the OpenId token has an invalid 'azp' claim")
		} else if oidCfg.ClientId != authorizedPartyClaim {
			return fmt.Errorf("the OpenId token is not targeted for Kiali; got azp = %v", authorizedPartyClaim)
		}
	}

	// Currently, we only support tokens with an RSA signature with SHA-256, which is the default in the OIDC spec
	if algHeader, ok := openIdParams.ParsedIdToken.Header["alg"].(string); !ok || algHeader != "RS256" {
		return fmt.Errorf("the OpenId token has unexpected alg header claim; got alg = '%s'", algHeader)
	}

	// Check iat (issued at) claim
	if iatClaim, ok := idTokenClaims["iat"]; !ok {
		return errors.New("the OpenId token has no iat claim or is invalid")
	} else {
		parsedIat, parseErr := parseTimeClaim(iatClaim)
		if parseErr != nil {
			return fmt.Errorf("the OpenId token has an invalid iat claim: %w", parseErr)
		}
		if parsedIat == 0 {
			// This is weird. This would mean an invalid type
			return fmt.Errorf("the OpenId token has an invalid value in the iat claim; got '%v'", iatClaim)
		}

		// Let's do the minimal check to ensure that the token wasn't issued in the future
		// we add a little offset to "now" to add one minute tolerance
		iatTime := time.Unix(parsedIat, 0)
		nowTime := util.Clock.Now().Add(60 * time.Second)
		if iatTime.After(nowTime) {
			return fmt.Errorf("we don't like people living in the future - enjoy the present!; iat = '%d'", parsedIat)
		}
	}

	// Check exp (expiration time) claim
	// The OIDC spec says: "The current time MUST be before the time represented by the exp Claim"
	// No tolerance for this check.
	if !util.Clock.Now().Before(openIdParams.ExpiresOn) {
		return fmt.Errorf("the OpenId token has expired; exp = '%s'", openIdParams.ExpiresOn.String())
	}

	// There are other claims that could be checked, but are not verified here:
	//   - nonce: This should be verified regardless if RBAC is on/off. So, it's verified in
	//       another part of the authentication flow.
	//   - acr: we are not asking for this claim at authorization, so the IdP doesn't
	//       need to provide it nor we need to verify it.
	//   - auth_time: we are not asking for this claim at authorization, so the IdP doesn't
	//	     need to provide it nor we need to verify it.

	// If execution flow reached this point, all claims look valid, but that won't guarantee that
	// the id_token hasn't been tampered. So, we check the signature to find if
	// the token is genuine
	if kidHeader, ok := openIdParams.ParsedIdToken.Header["kid"]; !ok {
		return errors.New("the OpenId token is missing the kid header claim")
	} else {
		if jws, parseErr := jose.ParseSigned(openIdParams.IdToken); parseErr != nil {
			return fmt.Errorf("error when parsing the OpenId token: %w", parseErr)
		} else {
			if len(jws.Signatures) == 0 {
				return errors.New("an unsigned OpenId token is not acceptable")
			}

			matchingKey, findKeyErr := GetJwkFromKeySet(kidHeader.(string))
			if findKeyErr != nil {
				return fmt.Errorf("something went wrong when trying to find the key that signed the OpenId token: %w", findKeyErr)
			}
			if matchingKey == nil {
				return errors.New("the OpenId token is signed with an unknown key")
			}

			_, signVerifyErr := jws.Verify(matchingKey)
			if signVerifyErr != nil {
				return fmt.Errorf("the signature of the OpenId token is invalid: %w", signVerifyErr)
			}
		}
	}

	return nil
}

func VerifyOpenIdUserAccess(token string) (int, string, error) {
	// Create business layer using the id_token
	business, err := Get(&api.AuthInfo{Token: token})
	if err != nil {
		return http.StatusInternalServerError, "Error instantiating the business layer", err
	}

	// Using the namespaces API to check if token is valid. In Kubernetes, the version API seems to allow
	// anonymous access, so it's not feasible to use the version API for token verification.
	nsList, err := business.Namespace.GetNamespaces()
	if err != nil {
		return http.StatusUnauthorized, "Token is not valid or is expired", err
	}

	// If namespace list is empty, return unauthorized error
	if len(nsList) == 0 {
		return http.StatusUnauthorized, "Cannot view any namespaces. Please read Kiali's RBAC documentation for more details.", nil
	}

	return http.StatusOK, "", nil
}

// As it turns out, the response from time claims can be either a f64 and
// a json.Number. With this, we take care of it, converting to the int64
// that we need to use timestamps in go.
func parseTimeClaim(claimValue interface{}) (int64, error) {
	var err error
	parsedTime := int64(0)

	switch exp := claimValue.(type) {
	case float64:
		// This can not fail
		parsedTime = int64(exp)
	case json.Number:
		// This can fail, so we short-circuit if we get an invalid value.
		parsedTime, err = exp.Int64()

		if err != nil {
			return 0, err
		}
	default:
		return 0, errors.New("the 'exp' claim of the OpenId token has invalid type")
	}

	return parsedTime, nil
}

func createHttpClient(toUrl string) (*http.Client, error) {
	cfg := config.Get().Auth.OpenId
	parsedUrl, err := url.Parse(toUrl)

	if err != nil {
		return nil, err
	}

	httpTransport := &http.Transport{}
	if cfg.InsecureSkipVerifyTLS {
		httpTransport.TLSClientConfig = &tls.Config{
			InsecureSkipVerify: true,
		}
	}

	if cfg.HTTPProxy != "" || cfg.HTTPSProxy != "" {
		proxyFunc := getProxyForUrl(parsedUrl, cfg.HTTPProxy, cfg.HTTPSProxy)
		httpTransport.Proxy = proxyFunc
	}

	httpClient := http.Client{
		Timeout:   time.Second * 10,
		Transport: httpTransport,
	}

	return &httpClient, nil
}
