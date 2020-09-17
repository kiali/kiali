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
	"strings"
	"time"

	"github.com/dgrijalva/jwt-go"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

const (
	OpenIdNonceCookieName = config.TokenCookieName + "-openid-nonce"
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
	Code          string
	ExpiresOn     time.Time
	IdToken       string
	Nonce         string
	NonceHash     []byte
	ParsedIdToken *jwt.Token
	State         string
	Subject       string
}

var cachedOpenIdMetadata *OpenIdMetadata

func BuildOpenIdJwtClaims(openIdParams *OpenIdCallbackParams) *config.IanaClaims {
	return &config.IanaClaims{
		SessionId: openIdParams.IdToken,
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
	openIdParams.ExpiresOn = time.Now().Add(time.Second * time.Duration(config.Get().LoginToken.ExpirationSeconds))

	// If the expiration date is present on the claim, we use that
	expiresInNumber := int64(0)

	// As it turns out, the response from the exp claim can be either a f64 and
	// a json.Number. With this, we take care of it, converting to the int64
	// that we need to use timestamps in go.
	switch exp := idTokenClaims["exp"].(type) {
	case float64:
		// This can not fail
		expiresInNumber = int64(exp)
	case json.Number:
		// This can fail, so we short-circuit if we get an invalid value.
		expiresInNumber, err = exp.Int64()

		if err != nil {
			return fmt.Errorf("token exp claim is present, but invalid: %w", err)
		}
	}

	if expiresInNumber != 0 {
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

func GetOpenIdAesSession(r *http.Request) (*config.IanaClaims, error) {
	authCookie, err := r.Cookie(config.TokenCookieName + "-aes")
	if err != nil {
		if err == http.ErrNoCookie {
			return nil, nil
		}
		return nil, err
	}

	cipherSessionData, err := base64.StdEncoding.DecodeString(authCookie.Value)
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

// GetOpenIdMetadata fetches the OpenId metadata using the configured Issuer URI and
// downloading the metadata from the well-known path '/.well-known/openid-configuration'. Some
// validations are performed and the parsed metadata is returned. Since the metadata should be
// rare to change, the retrieved metadata is cached on first call and subsequent calls return
// the cached metadata.
func GetOpenIdMetadata() (*OpenIdMetadata, error) {
	if cachedOpenIdMetadata != nil {
		return cachedOpenIdMetadata, nil
	}

	cfg := config.Get().Auth.OpenId

	// Remove trailing slash from issuer URI, if needed
	trimmedIssuerUri := strings.TrimRight(cfg.IssuerUri, "/")

	// Create HTTP client
	httpTransport := &http.Transport{}
	if cfg.InsecureSkipVerifyTLS {
		httpTransport.TLSClientConfig = &tls.Config{
			InsecureSkipVerify: true,
		}
	}

	httpClient := http.Client{
		Timeout:   time.Second * 10,
		Transport: httpTransport,
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

	// Create HTTP client
	httpTransport := &http.Transport{}
	if cfg.InsecureSkipVerifyTLS {
		httpTransport.TLSClientConfig = &tls.Config{
			InsecureSkipVerify: true,
		}
	}

	httpClient := http.Client{
		Timeout:   time.Second * 10,
		Transport: httpTransport,
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
		IdToken string `json:"id_token"`
	}

	err = json.Unmarshal(rawTokenResponse, &tokenResponse)
	if err != nil {
		return fmt.Errorf("cannot parse OpenId token response: %w", err)
	}

	if len(tokenResponse.IdToken) == 0 {
		return errors.New("the IdP did not provide an id_token")
	}

	openIdParams.IdToken = tokenResponse.IdToken
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

func VerifyOpenIdUserAccess(token string) (int, string, error) {
	// Create business layer using the id_token
	business, err := Get(token)
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
