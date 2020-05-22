package business

import (
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"

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

func GetOpenIdMetadata() (*OpenIdMetadata, error) {
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

	httpClient := http.Client{Transport: httpTransport}

	// Fetch IdP metadata
	response, err := httpClient.Get(trimmedIssuerUri + "/.well-known/openid-configuration")
	if err != nil {
		return nil, err
	}

	defer response.Body.Close()
	if response.StatusCode != 200 {
		return nil, errors.New(fmt.Sprintf("cannot fetch OpenId Metadata (HTTP response status = %s)", response.Status))
	}

	// Parse JSON document
	var metadata OpenIdMetadata

	rawMetadata, err := ioutil.ReadAll(response.Body)
	err = json.Unmarshal(rawMetadata, &metadata)
	if err != nil {
		return nil, errors.New(fmt.Sprintf("cannot parse OpenId Metadata: %v", err.Error()))
	}

	// Validate issuer == issuerUri
	if metadata.Issuer != cfg.IssuerUri {
		return nil, errors.New("mismatch between the configured issuer_uri and the exposed Issuer URI in OpenId provider metadata")
	}

	// Validate there is an authorization endpoint
	if len(metadata.AuthURL) == 0 {
		return nil, errors.New("the OpenID provider does not expose an authorization endpoint")
	}

	// Log warning if OpenId provider Metadata does not expose "id_token" in it's supported response types.
	// It's possible to try authentication. If metadata is right, the error will be evident to the user when trying to login.
	responseTypes := strings.Join(metadata.ResponseTypesSupported, " ")
	if !strings.Contains(responseTypes, "id_token") {
		log.Warning("Configured OpenID provider informs response_type=id_token is unsupported. Users may not able to login.")
	}

	// Log warning if OpenId provider informs that some of the configured scopes are not supported
	// It's possible to try authentication. If metadata is right, the error will be evident to the user when trying to login.
	scopes := cfg.Scopes
	if !strings.Contains(strings.Join(scopes, " "), "openid") {
		scopes = append(scopes, "openid")
	}
	for _, scope := range scopes {
		isScopeSupported := false
		for _, supportedScope := range metadata.ScopesSupported {
			if scope == supportedScope {
				isScopeSupported = true
				break
			}
		}

		if !isScopeSupported {
			log.Warning("Configured OpenID provider informs some of the configured scopes are unsupported. Users may not able to login.")
			break
		}
	}

	// Return parsed metadata
	return &metadata, nil
}
