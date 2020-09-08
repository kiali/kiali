package business

import (
	"crypto/aes"
	"crypto/cipher"
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

var cachedOpenIdMetadata *OpenIdMetadata

func ExtractOpenIdClaimsOfInterest(token string) (sub, nonce string, expiresOn time.Time, errorMessage string, detailedError error) {
	// Parse the received id_token from the IdP
	parsedIdToken, _, err := new(jwt.Parser).ParseUnverified(token, jwt.MapClaims{})
	if err != nil {
		errorMessage = "Cannot parse received id_token from the OpenId provider"
		detailedError = err
		return
	}
	idTokenClaims := parsedIdToken.Claims.(jwt.MapClaims)

	if nonceClaim, ok := idTokenClaims["nonce"]; !ok {
		nonce = nonceClaim.(string)
	}

	// Set a default value for expiration date
	expiresOn = time.Now().Add(time.Second * time.Duration(config.Get().LoginToken.ExpirationSeconds))

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
			errorMessage = "Token exp claim is present, but invalid."
			detailedError = err
			return
		}
	}

	if expiresInNumber != 0 {
		expiresOn = time.Unix(expiresInNumber, 0)
	}

	// Now that we know that the OpenId token is valid, parse/decode it to extract
	// the name of the service account. The "subject" is passed to the front-end to be displayed.
	sub = "OpenId User" // Set a default value
	if userClaim, ok := idTokenClaims[config.Get().Auth.OpenId.UsernameClaim]; ok && len(userClaim.(string)) > 0 {
		sub = userClaim.(string)
	}

	return
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

func RequestOpenIdToken(code, redirect_uri string) (string, error) {
	openIdMetadata, err := GetOpenIdMetadata()
	if err != nil {
		return "", err
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

	// Exchange authentication code for a token
	requestParams := url.Values{}
	requestParams.Set("client_id", cfg.ClientId) // Can omit if not authenticated
	requestParams.Set("code", code)
	requestParams.Set("grant_type", "authorization_code")
	requestParams.Set("redirect_uri", redirect_uri)
	response, err := httpClient.PostForm(openIdMetadata.TokenURL, requestParams)
	if err != nil {
		return "", fmt.Errorf("failure when requesting token from IdP: %s", err.Error())
	}

	defer response.Body.Close()
	rawTokenResponse, err := ioutil.ReadAll(response.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read token response from IdP: %s", err.Error())
	}

	if response.StatusCode != 200 {
		return "", fmt.Errorf("cannot get token from IdP (HTTP response status = %s)", response.Status)
	}

	// Parse token response
	var tokenResponse struct {
		IdToken     string `json:"id_token"`
	}

	err = json.Unmarshal(rawTokenResponse, &tokenResponse)
	if err != nil {
		return "", fmt.Errorf("cannot parse OpenId token response: %s", err.Error())
	}

	if len(tokenResponse.IdToken) == 0 {
		return "", errors.New("the IdP did not provide an id_token")
	}
	
	return tokenResponse.IdToken, nil
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
		return http.StatusUnauthorized, "Not enough privileges to login", nil
	}

	return http.StatusOK, "", nil
}
