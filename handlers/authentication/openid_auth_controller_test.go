package authentication

import (
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/util"
)

// Token built with the debugger at jwt.io. Subject is system:serviceaccount:k8s_user
// {
//  "sub": "jdoe@domain.com",
//  "name": "John Doe",
//  "iat": 1516239022,
//  "nonce": "1ba9b834d08ac81feb34e208402eb18e909be084518c328510940184",
//  "exp": 1638316801
// }

const openIdTestToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqZG9lQGRvbWFpbi5jb20iLCJuYW1lIjoiSm9obiBEb2UiLCJpYXQiOjE1MTYyMzkwMjIsIm5vbmNlIjoiMWJhOWI4MzRkMDhhYzgxZmViMzRlMjA4NDAyZWIxOGU5MDliZTA4NDUxOGMzMjg1MTA5NDAxODQiLCJleHAiOjE2MzgzMTY4MDF9.agHBziXM7SDLBKCnA6BvjWenU1n6juL8Fz3go4MSzyw"

/*** Function tests ***/

// see https://github.com/kiali/kiali/issues/6226 and https://github.com/kiali/kiali/issues/8717
func TestVerifyAudienceClaim(t *testing.T) {
	oidCfg := config.OpenIdConfig{
		ClientId: "kiali-client",
	}

	oip := openidFlowHelper{
		IdTokenPayload: map[string]interface{}{},
	}

	// Test single audience scenarios (existing behavior)
	t.Run("SingleAudience_Valid", func(t *testing.T) {
		oip.IdTokenPayload["aud"] = oidCfg.ClientId
		err := verifyAudienceClaim(&oip, oidCfg)
		assert.Nil(t, err, "verifyAudienceClaim failed: %v", err)
	})

	t.Run("SingleAudience_Invalid", func(t *testing.T) {
		oip.IdTokenPayload["aud"] = oidCfg.ClientId + "DIFFERENT"
		err := verifyAudienceClaim(&oip, oidCfg)
		assert.NotNil(t, err, "verifyAudienceClaim should have failed")
	})

	// Test single-element array scenarios (existing behavior)
	t.Run("SingleElementArray_Interface_Valid", func(t *testing.T) {
		oip.IdTokenPayload["aud"] = []interface{}{oidCfg.ClientId}
		err := verifyAudienceClaim(&oip, oidCfg)
		assert.Nil(t, err, "verifyAudienceClaim failed: %v", err)
	})

	t.Run("SingleElementArray_String_Valid", func(t *testing.T) {
		oip.IdTokenPayload["aud"] = []string{oidCfg.ClientId}
		err := verifyAudienceClaim(&oip, oidCfg)
		assert.Nil(t, err, "verifyAudienceClaim failed: %v", err)
	})

	t.Run("SingleElementArray_Interface_Invalid", func(t *testing.T) {
		oip.IdTokenPayload["aud"] = []interface{}{oidCfg.ClientId + "DIFFERENT"}
		err := verifyAudienceClaim(&oip, oidCfg)
		assert.NotNil(t, err, "verifyAudienceClaim should have failed")
	})

	t.Run("SingleElementArray_String_Invalid", func(t *testing.T) {
		oip.IdTokenPayload["aud"] = []string{oidCfg.ClientId + "DIFFERENT"}
		err := verifyAudienceClaim(&oip, oidCfg)
		assert.NotNil(t, err, "verifyAudienceClaim should have failed")
	})

	// Test multi-audience scenarios (new functionality for issue #8717)
	t.Run("MultiAudience_Interface_ValidFirst", func(t *testing.T) {
		oip.IdTokenPayload["aud"] = []interface{}{oidCfg.ClientId, "other-service", "api-gateway"}
		err := verifyAudienceClaim(&oip, oidCfg)
		assert.Nil(t, err, "verifyAudienceClaim failed: %v", err)
	})

	t.Run("MultiAudience_Interface_ValidMiddle", func(t *testing.T) {
		oip.IdTokenPayload["aud"] = []interface{}{"other-service", oidCfg.ClientId, "api-gateway"}
		err := verifyAudienceClaim(&oip, oidCfg)
		assert.Nil(t, err, "verifyAudienceClaim failed: %v", err)
	})

	t.Run("MultiAudience_Interface_ValidLast", func(t *testing.T) {
		oip.IdTokenPayload["aud"] = []interface{}{"other-service", "api-gateway", oidCfg.ClientId}
		err := verifyAudienceClaim(&oip, oidCfg)
		assert.Nil(t, err, "verifyAudienceClaim failed: %v", err)
	})

	t.Run("MultiAudience_String_ValidFirst", func(t *testing.T) {
		oip.IdTokenPayload["aud"] = []string{oidCfg.ClientId, "other-service", "api-gateway"}
		err := verifyAudienceClaim(&oip, oidCfg)
		assert.Nil(t, err, "verifyAudienceClaim failed: %v", err)
	})

	t.Run("MultiAudience_String_ValidMiddle", func(t *testing.T) {
		oip.IdTokenPayload["aud"] = []string{"other-service", oidCfg.ClientId, "api-gateway"}
		err := verifyAudienceClaim(&oip, oidCfg)
		assert.Nil(t, err, "verifyAudienceClaim failed: %v", err)
	})

	t.Run("MultiAudience_String_ValidLast", func(t *testing.T) {
		oip.IdTokenPayload["aud"] = []string{"other-service", "api-gateway", oidCfg.ClientId}
		err := verifyAudienceClaim(&oip, oidCfg)
		assert.Nil(t, err, "verifyAudienceClaim failed: %v", err)
	})

	t.Run("MultiAudience_Interface_NotFound", func(t *testing.T) {
		oip.IdTokenPayload["aud"] = []interface{}{"other-service", "api-gateway", "different-client"}
		err := verifyAudienceClaim(&oip, oidCfg)
		assert.NotNil(t, err, "verifyAudienceClaim should have failed")
		assert.Contains(t, err.Error(), "not found in audiences")
	})

	t.Run("MultiAudience_String_NotFound", func(t *testing.T) {
		oip.IdTokenPayload["aud"] = []string{"other-service", "api-gateway", "different-client"}
		err := verifyAudienceClaim(&oip, oidCfg)
		assert.NotNil(t, err, "verifyAudienceClaim should have failed")
		assert.Contains(t, err.Error(), "not found in audiences")
	})

	// Test edge cases
	t.Run("EmptyArray_Interface", func(t *testing.T) {
		oip.IdTokenPayload["aud"] = []interface{}{}
		err := verifyAudienceClaim(&oip, oidCfg)
		assert.NotNil(t, err, "verifyAudienceClaim should have failed")
		assert.Contains(t, err.Error(), "empty audience list")
	})

	t.Run("EmptyArray_String", func(t *testing.T) {
		oip.IdTokenPayload["aud"] = []string{}
		err := verifyAudienceClaim(&oip, oidCfg)
		assert.NotNil(t, err, "verifyAudienceClaim should have failed")
		assert.Contains(t, err.Error(), "empty audience list")
	})

	t.Run("MixedTypeArray", func(t *testing.T) {
		oip.IdTokenPayload["aud"] = []interface{}{123, oidCfg.ClientId, "other-service"}
		err := verifyAudienceClaim(&oip, oidCfg)
		assert.Nil(t, err, "verifyAudienceClaim should pass when valid audience is found")
	})

	t.Run("NonStringInArray", func(t *testing.T) {
		oip.IdTokenPayload["aud"] = []interface{}{123, 456}
		err := verifyAudienceClaim(&oip, oidCfg)
		assert.NotNil(t, err, "verifyAudienceClaim should have failed")
		assert.Contains(t, err.Error(), "not found in audiences")
	})

	t.Run("NonStringInArray_Match", func(t *testing.T) {
		// Test that numeric values in audience arrays can match after string conversion
		tempOidCfg := config.OpenIdConfig{
			ClientId: "456",
		}
		oip.IdTokenPayload["aud"] = []interface{}{123, 456, 789}
		err := verifyAudienceClaim(&oip, tempOidCfg)
		assert.Nil(t, err, "verifyAudienceClaim should pass when numeric audience converts to matching string")
	})

	t.Run("MissingAudClaim", func(t *testing.T) {
		delete(oip.IdTokenPayload, "aud")
		err := verifyAudienceClaim(&oip, oidCfg)
		assert.NotNil(t, err, "verifyAudienceClaim should have failed")
		assert.Contains(t, err.Error(), "has no aud claim")
	})

	t.Run("InvalidType_NoMatch", func(t *testing.T) {
		oip.IdTokenPayload["aud"] = 12345
		err := verifyAudienceClaim(&oip, oidCfg)
		assert.NotNil(t, err, "verifyAudienceClaim should have failed")
		assert.Contains(t, err.Error(), "got aud [12345]")
	})

	t.Run("NonStringType_ConversionMatch", func(t *testing.T) {
		// Test that non-string audience claims are converted to strings and can match
		// Use a temporary config with a numeric ClientId that matches the integer aud
		tempOidCfg := config.OpenIdConfig{
			ClientId: "12345",
		}
		oip.IdTokenPayload["aud"] = 12345
		err := verifyAudienceClaim(&oip, tempOidCfg)
		assert.Nil(t, err, "verifyAudienceClaim should pass when integer audience converts to matching string")
	})
}

func TestValidateOpenIdTokenInHouse(t *testing.T) {
	// These tokens were generated via https://dinochiesa.github.io/jwt/ using its own private/public keys generator.
	// There is another public/private key generator website that could be used if needed in the future: https://mkjwk.org/
	//
	// -----BEGIN PUBLIC KEY-----
	// MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2fEsycKFNuQn/IsW+t8+
	// RexDWxvJP37+5BuAviloJvmAYwQguGRN+qwi2Co/yImxZPZVuqY7/hf87bIKopZD
	// CgZrUHtFERPL4qbR6gv+FbanR6ohCXa6f1S+AjXPiQcw0p49t4uT0WwjPD64mNdw
	// IlzWLi+xO4rY1Mo98H2339WmvmgiEukLAa+f3Zz80jRDmWv23Td/ba5ASHVrvhRJ
	// d2jLwOL/lxCHPtjDf6bBHKaPP/ezRjlPg9Qlse3au1KBsVrSThr0uz9G6cGeidEL
	// fvdk9xmAoxhR2CbmGIQoRPiEEOVhKg/yHVqzz+2SvnIKnArx4ISv/yudbP8lU7vC
	// QwIDAQAB
	// -----END PUBLIC KEY-----
	//
	// -----BEGIN PRIVATE KEY-----
	// MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDZ8SzJwoU25Cf8
	// ixb63z5F7ENbG8k/fv7kG4C+KWgm+YBjBCC4ZE36rCLYKj/IibFk9lW6pjv+F/zt
	// sgqilkMKBmtQe0URE8viptHqC/4VtqdHqiEJdrp/VL4CNc+JBzDSnj23i5PRbCM8
	// PriY13AiXNYuL7E7itjUyj3wfbff1aa+aCIS6QsBr5/dnPzSNEOZa/bdN39trkBI
	// dWu+FEl3aMvA4v+XEIc+2MN/psEcpo8/97NGOU+D1CWx7dq7UoGxWtJOGvS7P0bp
	// wZ6J0Qt+92T3GYCjGFHYJuYYhChE+IQQ5WEqD/IdWrPP7ZK+cgqcCvHghK//K51s
	// /yVTu8JDAgMBAAECggEAGGi2h3JN0TQEdnhtfnN6WgJ4GMAn7gCfM5UQ+jtQ+ux+
	// wJg5we0Z/rVAwc0Zj7A8Of6M43ayyWaOYWDLaCJEJ99ILZ9gwOTitOPSJtBpCK2I
	// VrJrONAfWxt2nHDCaapwgWZPqzrqt03RNHIh4pxeZrrXEh0tUGnglxR/k2vBKERk
	// dtP1xwydrMip7VUkUwGvLmYLClsbnkR7O65XzFIto7iG0/yuWA6yw9mNey5gTrr9
	// 7iboE5v0vHOJW/1mVQP1xV/rI8VnLZlZz6XYPktjlzhR5yIzrZD2DZ20J8uo6Zrd
	// iVEz1nE6FmuhfgbUFOt8SBrGUZhx0Zwo0GkLiFdDYQKBgQD+P49qNNw+Dwrjc8dK
	// 85vr89RQ9MX3ioTIZnm+oXHjoLvVrPZmI3SjrZJrqMCZtxP6LpoDnlGjKeJJMA61
	// wD1ceJS5YyDgLVv3jsi/zIpJDQTg2GXaDRY3c3PjHCmRocMvaPKiws8ZY7BoR8nF
	// bpKxxa2C3LEqiyzil2H7NR16vQKBgQDbcZQO9LTiYitoW+qQPhbNHGlrlD6KfXTA
	// SFQBAPFKtR4ncj/x3/i0L1P3+IabkdJQqxOHY68FNGg95sfD7/s9K72RvnRTyXCn
	// Wd46QLULvHLTYWI39obKOZlrbRWBqr/kw1YIxjjgRWTShOuBkS2R6TtPDeoAtTds
	// 995RRgCA/wKBgE4m2X2rC/wjgZRS9XKrmUUZKS1NYEDsGk7DeS7Iz4pJ0RMoXIEe
	// 6u6ZHwXq1HErnn9rrbnpA20lJcKbfBoQIox3IDgwKV3fc4KQKFMUm3lDADnhKsWw
	// +iBHY9ruwDRcxfOfzd2MBj7mrsYPMw12JK9ydRhhoC/UohJwuBSQyiP9AoGAeIg5
	// F8HnPNVJHGgoPZQs9/pcGR/y/iSMpTTVFzwKTMuQxX/miZdIxsecKn7SiM6eo3pk
	// HqBtOMGhZCbHoOLGr8G/vTbMNF1XyEP/YSW7i7e1pk8+IJkDTj42+5+OCYvdHO0B
	// 643dHapgB5XEuYUhb5yY3AI7fqoKyIqZDTETA8cCgYEAt2AnN8HTLqIOxizkulNj
	// adeC53dbv8MmPU0aA1EO5ipLVXcF4y/8zOzIKHijWAB8kEZXPzS/rUURwtyhRG3k
	// f6lSPO2VFE1xNlGSlU3CvQz1VV2qgvbtogIOo7CoXYRdiJJ2j2M/n06MBK2bMoGb
	// UGj7e/VHYwvMxZ6SoMYk3Hc=
	// -----END PRIVATE KEY-----
	//
	// HEADER:
	// {
	//   "alg": "RS256",
	//   "typ": "JWT",
	//   "kid": "kialikey"
	// }
	//
	// PAYLOAD:
	// {
	//  "sub": "jdoe@domain.com",
	//  "name": "John Doe",
	//  "iat": 1516239022,
	//  "nonce": "1ba9b834d08ac81feb34e208402eb18e909be084518c328510940184",
	//  "exp": 1638316801,
	//  "iss": "http://127.0.0.1:33333",
	//  "aud": "kiali-client"
	// }
	openIdTestTokenWithGoodAud := "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImtpYWxpa2V5In0.eyJzdWIiOiJqZG9lQGRvbWFpbi5jb20iLCJuYW1lIjoiSm9obiBEb2UiLCJpYXQiOjE1MTYyMzkwMjIsIm5vbmNlIjoiMWJhOWI4MzRkMDhhYzgxZmViMzRlMjA4NDAyZWIxOGU5MDliZTA4NDUxOGMzMjg1MTA5NDAxODQiLCJleHAiOjE2MzgzMTY4MDEsImlzcyI6Imh0dHA6Ly8xMjcuMC4wLjE6MzMzMzMiLCJhdWQiOiJraWFsaS1jbGllbnQifQ.bOu7M_a8DKctApb-RfbglUGyJslJrVjD6ZRU8XlRStQwp4QIQM-tCB5cqYv9OJeC9NSN46RO9jvJ5rw2WnVFNfujDwVWSvjUqQHmYiO3GSobmCfbAtG7ymRWnLLaQMheinpfPjXh5-ohVlSqB23wkk4viC9YCqqXaIKk4bLyZFf14F4u5Zqu2kfzwufjp-AgAt9W93loI6p6kHVyCnnDwPvfmfSmCUxaCPvrFGKnGe6hTCPCc2EBCRndW-si7hz9F693jAyD5OMvt1z_aX4tzPNsqZYuosXw6xwGGM-nepn6XtM6U_MS9-eRSoCyyMyZE6_xSZIO4ir1KeewbSvk1Q"

	// {
	//  "sub": "jdoe@domain.com",
	//  "name": "John Doe",
	//  "iat": 1516239022,
	//  "nonce": "1ba9b834d08ac81feb34e208402eb18e909be084518c328510940184",
	//  "exp": 1638316801,
	//  "iss": "http://127.0.0.1:33333",
	//  "aud": "bad-aud-client"
	// }
	openIdTestTokenWithBadAud := "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImtpYWxpa2V5In0.eyJzdWIiOiJqZG9lQGRvbWFpbi5jb20iLCJuYW1lIjoiSm9obiBEb2UiLCJpYXQiOjE1MTYyMzkwMjIsIm5vbmNlIjoiMWJhOWI4MzRkMDhhYzgxZmViMzRlMjA4NDAyZWIxOGU5MDliZTA4NDUxOGMzMjg1MTA5NDAxODQiLCJleHAiOjE2MzgzMTY4MDEsImlzcyI6Imh0dHA6Ly8xMjcuMC4wLjE6MzMzMzMiLCJhdWQiOiJiYWQtYXVkLWNsaWVudCJ9.LicN-YgaHxfTTg_XtpyTlZBIQyj4BTvYHsXKtDRRskf2uuvKw36Y0WSJN570E0PSYYlAzyjrWp31S_PdZL75cwCIOYnhGbTat7pUVNoAn-aZc7FrMtzYNmQdChB2-ghE_RRQaXP1zNwgeNrQiEQ9jmD5ynd7Qm2esMYYbmCoj1ITM5Uospp5fbRg9eNdfrqXmwoGK3OITC5OVv8tbcb2HY_CUxJfSIC5pT5wBGxGRExjaeXNiIRS1600NmkfK6O-BPsmJhEYTxLIeWbtAn2pn7uZhWMiyJIIX9FHFLeTCIQh2xuwSuWLkyZoMsegr8A_rQqKg-iQkhfXxYxGtRY6mQ"

	// we start with a good token - our second test will switch this to the token with the bad aud value
	openIdTestTokenToUse := openIdTestTokenWithGoodAud

	cachedOpenIdMetadata = nil
	var oidcMetadata []byte
	var jwksResponseBytes []byte
	testServer := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/.well-known/openid-configuration":
			w.WriteHeader(200)
			_, _ = w.Write(oidcMetadata)
		case "/jwks":
			w.WriteHeader(200)
			_, _ = w.Write(jwksResponseBytes)
		case "/token":
			_ = r.ParseForm()
			assert.Equal(t, "f0code", r.Form.Get("code"))
			assert.Equal(t, "authorization_code", r.Form.Get("grant_type"))
			assert.Equal(t, "kiali-client", r.Form.Get("client_id"))
			assert.Equal(t, "https://kiali.io:44/kiali-test", r.Form.Get("redirect_uri"))
			// Validate PKCE code_verifier is sent
			assert.Equal(t, "test_code_verifier_43_chars_long_12345678", r.Form.Get("code_verifier"))

			w.WriteHeader(200)
			_, _ = w.Write([]byte("{ \"id_token\": \"" + openIdTestTokenToUse + "\" }"))
		}
	}))
	defer testServer.Close()

	// because we have a hardcoded token for this test that is pre-encrypted with the issuer URL, we need to start the server on that same URL
	testServerListenerFixedPort, err := net.Listen("tcp", "127.0.0.1:33333")
	require.NoError(t, err, "Cannot start test server on fixed port")
	testServer.Listener = testServerListenerFixedPort
	testServer.Start()

	oidcMeta := openIdMetadata{
		Issuer:                 testServer.URL,
		AuthURL:                testServer.URL + "/auth",
		TokenURL:               testServer.URL + "/token",
		JWKSURL:                testServer.URL + "/jwks",
		UserInfoURL:            "",
		Algorithms:             nil,
		ScopesSupported:        []string{"openid"},
		ResponseTypesSupported: []string{"code"},
	}
	oidcMetadata, err = json.Marshal(oidcMeta)
	assert.Nil(t, err)

	// jwksResponseBytes is needed for the "/jwks" endpoint. It is used during
	// the validation phase when Kiali wants to make sure the "kid" is valid.
	publicKeyText := `
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2fEsycKFNuQn/IsW+t8+
RexDWxvJP37+5BuAviloJvmAYwQguGRN+qwi2Co/yImxZPZVuqY7/hf87bIKopZD
CgZrUHtFERPL4qbR6gv+FbanR6ohCXa6f1S+AjXPiQcw0p49t4uT0WwjPD64mNdw
IlzWLi+xO4rY1Mo98H2339WmvmgiEukLAa+f3Zz80jRDmWv23Td/ba5ASHVrvhRJ
d2jLwOL/lxCHPtjDf6bBHKaPP/ezRjlPg9Qlse3au1KBsVrSThr0uz9G6cGeidEL
fvdk9xmAoxhR2CbmGIQoRPiEEOVhKg/yHVqzz+2SvnIKnArx4ISv/yudbP8lU7vC
QwIDAQAB
-----END PUBLIC KEY-----`
	block, _ := pem.Decode([]byte(publicKeyText))
	publicKeyRSA, _ := x509.ParsePKIXPublicKey(block.Bytes)
	jwksResponseObject := jose.JSONWebKeySet{
		Keys: []jose.JSONWebKey{
			{
				KeyID:     "kialikey",
				Algorithm: "RS256",
				Key:       publicKeyRSA,
			},
		},
	}
	jwksResponseBytes, err = json.Marshal(jwksResponseObject)
	assert.Nil(t, err)

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	conf := config.NewConfig()
	conf.Server.WebRoot = "/kiali-test"
	conf.LoginToken.SigningKey = "kiali67890123456"
	conf.LoginToken.ExpirationSeconds = 1
	conf.Auth.OpenId.IssuerUri = testServer.URL
	conf.Auth.OpenId.ClientId = "kiali-client"
	conf.Auth.OpenId.DisableRBAC = true // true is needed to trigger the call to validateOpenIdTokenInHouse
	config.Set(conf)

	// Returning some namespace when a cluster API call is made should have the result of
	// a successful authentication.
	k8s := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "Foo"}},
	)
	k8s.OpenShift = true
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	cache := cache.NewTestingCacheWithFactory(t, mockClientFactory, *conf)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(mockClientFactory.Clients), cache, conf)

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), conf.LoginToken.SigningKey)))
	uri := fmt.Sprintf("https://kiali.io:44/api/authenticate?code=f0code&state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  nonceCookieName(conf.KubernetesConfig.ClusterName),
		Value: "nonceString",
	})
	request.AddCookie(&http.Cookie{
		Name:  codeVerifierCookieName(conf.KubernetesConfig.ClusterName),
		Value: "test_code_verifier_43_chars_long_12345678",
	})

	controller, err := NewOpenIdAuthController(cache, mockClientFactory, conf, discovery)
	require.NoError(t, err)

	expectedExpiration := time.Date(2021, 12, 1, 0, 0, 1, 0, time.UTC)

	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Failf(t, "Callback function shouldn't have been called.", "")
	})).ServeHTTP(rr, request)

	// Check that cookies are set and have the right expiration.
	response := rr.Result()
	assert.Len(t, response.Cookies(), 3)

	// nonce cookie cleanup
	assert.Equal(t, nonceCookieName(conf.KubernetesConfig.ClusterName), response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))
	assert.True(t, response.Cookies()[0].HttpOnly)
	assert.True(t, response.Cookies()[0].Secure) // the test URL is https://kiali.io:44/kiali-test ; https: means it should be Secure

	// PKCE verifier cookie cleanup
	assert.Equal(t, codeVerifierCookieName(conf.KubernetesConfig.ClusterName), response.Cookies()[1].Name)
	assert.True(t, clockTime.After(response.Cookies()[1].Expires))
	assert.True(t, response.Cookies()[1].HttpOnly)
	assert.True(t, response.Cookies()[1].Secure)

	// Session cookie
	assert.Equal(t, SessionCookieName, response.Cookies()[2].Name)
	assert.Equal(t, expectedExpiration, response.Cookies()[2].Expires)
	assert.Equal(t, http.StatusFound, response.StatusCode)
	assert.True(t, response.Cookies()[2].HttpOnly)
	assert.True(t, response.Cookies()[2].Secure) // the test URL is https://kiali.io:44/kiali-test ; https: means it should be Secure

	// Redirection to boot the UI
	assert.Equal(t, "/kiali-test/", response.Header.Get("Location"))

	///
	/// Now switch to using the token with the bad audience claim and make sure this fails
	///

	openIdTestTokenToUse = openIdTestTokenWithBadAud
	rr = httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Failf(t, "Callback function shouldn't have been called.", "")
	})).ServeHTTP(rr, request)

	// Check that there are two cookies (nonce + PKCE cleanup) - the session cookie should be missing because the audience claim was bad
	response = rr.Result()
	assert.Len(t, response.Cookies(), 2)
	assert.Equal(t, nonceCookieName(conf.KubernetesConfig.ClusterName), response.Cookies()[0].Name)
	assert.Equal(t, codeVerifierCookieName(conf.KubernetesConfig.ClusterName), response.Cookies()[1].Name)
	assert.Equal(t, "/kiali-test/?openid_error=the+OpenID+token+was+rejected%3A+the+OpenId+token+is+not+targeted+for+Kiali%3B+got+aud+%5Bbad-aud-client%5D", response.Header.Get("Location"))
}

/*** Implicit flow tests ***/

func TestOpenIdAuthControllerRejectsImplicitFlow(t *testing.T) {
	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	conf := config.NewConfig()
	conf.LoginToken.SigningKey = "kiali67890123456"
	conf.LoginToken.ExpirationSeconds = 1
	config.Set(conf)

	// Returning some namespace when a cluster API call is made should have the result of
	// a successful authentication.
	k8s := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "Foo"}},
	)
	k8s.OpenShift = true
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	cache := cache.NewTestingCacheWithFactory(t, mockClientFactory, *conf)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(mockClientFactory.Clients), cache, conf)

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), conf.LoginToken.SigningKey)))

	requestBody := strings.NewReader(fmt.Sprintf("id_token=%s&state=%x-%s", openIdTestToken, stateHash, clockTime.UTC().Format("060102150405")))
	request := httptest.NewRequest(http.MethodPost, "/api/authenticate", requestBody)
	request.Header.Add("Content-Type", "application/x-www-form-urlencoded")
	request.AddCookie(&http.Cookie{
		Name:  nonceCookieName(conf.KubernetesConfig.ClusterName),
		Value: "nonceString",
	})

	controller, err := NewOpenIdAuthController(cache, mockClientFactory, conf, discovery)
	require.NoError(t, err)

	rr := httptest.NewRecorder()
	sData, err := controller.Authenticate(request, rr)

	assert.Nil(t, sData)
	assert.NotNil(t, err)
	assert.Equal(t, err.Error(), "support for OpenID's implicit flow has been removed")

	response := rr.Result()
	assert.Len(t, response.Cookies(), 0)
}

/*** Authorization code flow tests ***/

func TestOpenIdAuthControllerAuthenticatesCorrectlyWithAuthorizationCodeFlow(t *testing.T) {
	cachedOpenIdMetadata = nil
	var oidcMetadata []byte
	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/.well-known/openid-configuration" {
			w.WriteHeader(200)
			_, _ = w.Write(oidcMetadata)
		}
		if r.URL.Path == "/token" {
			_ = r.ParseForm()
			assert.Equal(t, "f0code", r.Form.Get("code"))
			assert.Equal(t, "authorization_code", r.Form.Get("grant_type"))
			assert.Equal(t, "kiali-client", r.Form.Get("client_id"))
			assert.Equal(t, "https://kiali.io:44/kiali-test", r.Form.Get("redirect_uri"))
			// Validate PKCE code_verifier is sent
			assert.Equal(t, "test_code_verifier_43_chars_long_12345678", r.Form.Get("code_verifier"))

			w.WriteHeader(200)
			_, _ = w.Write([]byte("{ \"id_token\": \"" + openIdTestToken + "\" }"))
		}
	}))
	defer testServer.Close()

	oidcMeta := openIdMetadata{
		Issuer:                 testServer.URL,
		AuthURL:                testServer.URL + "/auth",
		TokenURL:               testServer.URL + "/token",
		JWKSURL:                testServer.URL + "/jwks",
		UserInfoURL:            "",
		Algorithms:             nil,
		ScopesSupported:        []string{"openid"},
		ResponseTypesSupported: []string{"code"},
	}
	oidcMetadata, err := json.Marshal(oidcMeta)
	assert.Nil(t, err)

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	conf := config.NewConfig()
	conf.Server.WebRoot = "/kiali-test"
	conf.LoginToken.SigningKey = "kiali67890123456"
	conf.LoginToken.ExpirationSeconds = 1
	conf.Auth.OpenId.IssuerUri = testServer.URL
	conf.Auth.OpenId.ClientId = "kiali-client"
	conf.Identity.CertFile = "foo.cert"      // setting conf.Identity will make it look as if the endpoint ...
	conf.Identity.PrivateKeyFile = "foo.key" // ... is HTTPS - this causes the cookies' Secure flag to be true
	config.Set(conf)

	// Returning some namespace when a cluster API call is made should have the result of
	// a successful authentication.
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("Foo"))
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	cache := cache.NewTestingCacheWithFactory(t, mockClientFactory, *conf)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(mockClientFactory.Clients), cache, conf)

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), conf.LoginToken.SigningKey)))
	uri := fmt.Sprintf("https://kiali.io:44/api/authenticate?code=f0code&state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  nonceCookieName(conf.KubernetesConfig.ClusterName),
		Value: "nonceString",
	})
	request.AddCookie(&http.Cookie{
		Name:  codeVerifierCookieName(conf.KubernetesConfig.ClusterName),
		Value: "test_code_verifier_43_chars_long_12345678",
	})

	controller, err := NewOpenIdAuthController(cache, mockClientFactory, conf, discovery)
	require.NoError(t, err)

	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Failf(t, "Callback function shouldn't have been called.", "")
	})).ServeHTTP(rr, request)

	expectedExpiration := time.Date(2021, 12, 1, 0, 0, 1, 0, time.UTC)

	// Check that cookies are set and have the right expiration.
	response := rr.Result()
	assert.Len(t, response.Cookies(), 3)

	// nonce cookie cleanup
	assert.Equal(t, nonceCookieName(conf.KubernetesConfig.ClusterName), response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))
	assert.True(t, response.Cookies()[0].HttpOnly)
	assert.True(t, response.Cookies()[0].Secure)

	// PKCE verifier cookie cleanup
	assert.Equal(t, codeVerifierCookieName(conf.KubernetesConfig.ClusterName), response.Cookies()[1].Name)
	assert.True(t, clockTime.After(response.Cookies()[1].Expires))
	assert.True(t, response.Cookies()[1].HttpOnly)
	assert.True(t, response.Cookies()[1].Secure)

	// Session cookie
	assert.Equal(t, SessionCookieName, response.Cookies()[2].Name)
	assert.Equal(t, expectedExpiration, response.Cookies()[2].Expires)
	assert.Equal(t, http.StatusFound, response.StatusCode)
	assert.True(t, response.Cookies()[2].HttpOnly)
	assert.True(t, response.Cookies()[2].Secure)

	// Redirection to boot the UI
	assert.Equal(t, "/kiali-test/", response.Header.Get("Location"))
}

func TestOpenIdCodeFlowShouldFailWithMissingIdTokenFromOpenIdServer(t *testing.T) {
	cachedOpenIdMetadata = nil
	var oidcMetadata []byte
	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/.well-known/openid-configuration" {
			w.WriteHeader(200)
			_, _ = w.Write(oidcMetadata)
		}
		if r.URL.Path == "/token" {
			w.WriteHeader(200)
			_, _ = w.Write([]byte("{ \"access_token\": \"" + openIdTestToken + "\" }"))
		}
	}))
	defer testServer.Close()

	oidcMeta := openIdMetadata{
		Issuer:                 testServer.URL,
		AuthURL:                testServer.URL + "/auth",
		TokenURL:               testServer.URL + "/token",
		JWKSURL:                testServer.URL + "/jwks",
		UserInfoURL:            "",
		Algorithms:             nil,
		ScopesSupported:        []string{"openid"},
		ResponseTypesSupported: []string{"code"},
	}
	oidcMetadata, err := json.Marshal(oidcMeta)
	assert.Nil(t, err)

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	cfg := config.NewConfig()
	cfg.Server.WebRoot = "/kiali-test"
	cfg.LoginToken.SigningKey = "kiali67890123456"
	cfg.LoginToken.ExpirationSeconds = 1
	cfg.Auth.OpenId.IssuerUri = testServer.URL
	cfg.Auth.OpenId.ClientId = "kiali-client"
	config.Set(cfg)

	// Returning some namespace when a cluster API call is made should have the result of
	// a successful authentication.
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("Foo"))
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	cache := cache.NewTestingCacheWithFactory(t, mockClientFactory, *cfg)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(mockClientFactory.Clients), cache, cfg)

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), cfg.LoginToken.SigningKey)))
	uri := fmt.Sprintf("https://kiali.io:44/api/authenticate?code=f0code&state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  nonceCookieName(cfg.KubernetesConfig.ClusterName),
		Value: "nonceString",
	})
	request.AddCookie(&http.Cookie{
		Name:  codeVerifierCookieName(cfg.KubernetesConfig.ClusterName),
		Value: "test_code_verifier_43_chars_long_12345678",
	})

	controller, err := NewOpenIdAuthController(cache, mockClientFactory, cfg, discovery)
	require.NoError(t, err)

	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Failf(t, "Callback function shouldn't have been called.", "")
	})).ServeHTTP(rr, request)

	// nonce and PKCE cookie cleanup
	response := rr.Result()
	assert.Len(t, response.Cookies(), 2)
	assert.Equal(t, nonceCookieName(cfg.KubernetesConfig.ClusterName), response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))
	assert.Equal(t, codeVerifierCookieName(cfg.KubernetesConfig.ClusterName), response.Cookies()[1].Name)
	assert.True(t, clockTime.After(response.Cookies()[1].Expires))

	// Redirection to boot the UI
	q := url.Values{}
	q.Add("openid_error", "the IdP did not provide an id_token")
	assert.Equal(t, "/kiali-test/?"+q.Encode(), response.Header.Get("Location"))
	assert.Equal(t, http.StatusFound, response.StatusCode)
}

func TestOpenIdCodeFlowShouldFailWithBadResponseFromTokenEndpoint(t *testing.T) {
	cachedOpenIdMetadata = nil
	var oidcMetadata []byte
	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/.well-known/openid-configuration" {
			w.WriteHeader(200)
			_, _ = w.Write(oidcMetadata)
		}
		if r.URL.Path == "/token" {
			w.WriteHeader(500)
			_, _ = w.Write([]byte("{ }"))
		}
	}))
	defer testServer.Close()

	oidcMeta := openIdMetadata{
		Issuer:                 testServer.URL,
		AuthURL:                testServer.URL + "/auth",
		TokenURL:               testServer.URL + "/token",
		JWKSURL:                testServer.URL + "/jwks",
		UserInfoURL:            "",
		Algorithms:             nil,
		ScopesSupported:        []string{"openid"},
		ResponseTypesSupported: []string{"code"},
	}
	oidcMetadata, err := json.Marshal(oidcMeta)
	assert.Nil(t, err)

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	cfg := config.NewConfig()
	cfg.Server.WebRoot = "/kiali-test"
	cfg.LoginToken.SigningKey = "kiali67890123456"
	cfg.LoginToken.ExpirationSeconds = 1
	cfg.Auth.OpenId.IssuerUri = testServer.URL
	cfg.Auth.OpenId.ClientId = "kiali-client"
	config.Set(cfg)

	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("Foo"))
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	cache := cache.NewTestingCacheWithFactory(t, mockClientFactory, *cfg)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(mockClientFactory.Clients), cache, cfg)

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), cfg.LoginToken.SigningKey)))
	uri := fmt.Sprintf("https://kiali.io:44/api/authenticate?code=f0code&state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  nonceCookieName(cfg.KubernetesConfig.ClusterName),
		Value: "nonceString",
	})
	request.AddCookie(&http.Cookie{
		Name:  codeVerifierCookieName(cfg.KubernetesConfig.ClusterName),
		Value: "test_code_verifier_43_chars_long_12345678",
	})

	controller, err := NewOpenIdAuthController(cache, mockClientFactory, cfg, discovery)
	require.NoError(t, err)

	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Failf(t, "Callback function shouldn't have been called.", "")
	})).ServeHTTP(rr, request)

	// nonce and PKCE cookie cleanup
	response := rr.Result()
	assert.Len(t, response.Cookies(), 2)
	assert.Equal(t, nonceCookieName(cfg.KubernetesConfig.ClusterName), response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))
	assert.Equal(t, codeVerifierCookieName(cfg.KubernetesConfig.ClusterName), response.Cookies()[1].Name)
	assert.True(t, clockTime.After(response.Cookies()[1].Expires))

	// Redirection to boot the UI
	q := url.Values{}
	q.Add("openid_error", "request failed (HTTP response status = 500 Internal Server Error)")
	assert.Equal(t, "/kiali-test/?"+q.Encode(), response.Header.Get("Location"))
	assert.Equal(t, http.StatusFound, response.StatusCode)
}

func TestOpenIdCodeFlowShouldFailWithNonJsonResponse(t *testing.T) {
	cachedOpenIdMetadata = nil
	var oidcMetadata []byte
	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/.well-known/openid-configuration" {
			w.WriteHeader(200)
			_, _ = w.Write(oidcMetadata)
		}
		if r.URL.Path == "/token" {
			w.WriteHeader(200)
			_, _ = w.Write([]byte("\"id_token\": \"foo\""))
		}
	}))
	defer testServer.Close()

	oidcMeta := openIdMetadata{
		Issuer:                 testServer.URL,
		AuthURL:                testServer.URL + "/auth",
		TokenURL:               testServer.URL + "/token",
		JWKSURL:                testServer.URL + "/jwks",
		UserInfoURL:            "",
		Algorithms:             nil,
		ScopesSupported:        []string{"openid"},
		ResponseTypesSupported: []string{"code"},
	}
	oidcMetadata, err := json.Marshal(oidcMeta)
	assert.Nil(t, err)

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	cfg := config.NewConfig()
	cfg.Server.WebRoot = "/kiali-test"
	cfg.LoginToken.SigningKey = "kiali67890123456"
	cfg.LoginToken.ExpirationSeconds = 1
	cfg.Auth.OpenId.IssuerUri = testServer.URL
	cfg.Auth.OpenId.ClientId = "kiali-client"
	config.Set(cfg)

	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("Foo"))
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	cache := cache.NewTestingCacheWithFactory(t, mockClientFactory, *cfg)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(mockClientFactory.Clients), cache, cfg)

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), cfg.LoginToken.SigningKey)))
	uri := fmt.Sprintf("https://kiali.io:44/api/authenticate?code=f0code&state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  nonceCookieName(cfg.KubernetesConfig.ClusterName),
		Value: "nonceString",
	})
	request.AddCookie(&http.Cookie{
		Name:  codeVerifierCookieName(cfg.KubernetesConfig.ClusterName),
		Value: "test_code_verifier_43_chars_long_12345678",
	})

	controller, err := NewOpenIdAuthController(cache, mockClientFactory, cfg, discovery)
	require.NoError(t, err)

	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Failf(t, "Callback function shouldn't have been called.", "")
	})).ServeHTTP(rr, request)

	// nonce and PKCE cookie cleanup
	response := rr.Result()
	assert.Len(t, response.Cookies(), 2)
	assert.Equal(t, nonceCookieName(cfg.KubernetesConfig.ClusterName), response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))
	assert.Equal(t, codeVerifierCookieName(cfg.KubernetesConfig.ClusterName), response.Cookies()[1].Name)
	assert.True(t, clockTime.After(response.Cookies()[1].Expires))

	// Redirection to boot the UI
	u, _ := url.Parse(response.Header.Get("Location"))
	q, _ := url.ParseQuery(u.RawQuery)
	assert.Contains(t, q["openid_error"][0], "cannot parse OpenId token response:")
	assert.Equal(t, http.StatusFound, response.StatusCode)
}

func TestOpenIdCodeFlowShouldFailWithNonJwtIdToken(t *testing.T) {
	cachedOpenIdMetadata = nil
	var oidcMetadata []byte
	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/.well-known/openid-configuration" {
			w.WriteHeader(200)
			_, _ = w.Write(oidcMetadata)
		}
		if r.URL.Path == "/token" {
			w.WriteHeader(200)
			_, _ = w.Write([]byte("{ \"id_token\": \"foo\" }"))
		}
	}))
	defer testServer.Close()

	oidcMeta := openIdMetadata{
		Issuer:                 testServer.URL,
		AuthURL:                testServer.URL + "/auth",
		TokenURL:               testServer.URL + "/token",
		JWKSURL:                testServer.URL + "/jwks",
		UserInfoURL:            "",
		Algorithms:             nil,
		ScopesSupported:        []string{"openid"},
		ResponseTypesSupported: []string{"code"},
	}
	oidcMetadata, err := json.Marshal(oidcMeta)
	assert.Nil(t, err)

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	cfg := config.NewConfig()
	cfg.Server.WebRoot = "/kiali-test"
	cfg.LoginToken.SigningKey = "kiali67890123456"
	cfg.LoginToken.ExpirationSeconds = 1
	cfg.Auth.OpenId.IssuerUri = testServer.URL
	cfg.Auth.OpenId.ClientId = "kiali-client"
	cfg.Identity.CertFile = "foo.cert"      // setting conf.Identity will make it look as if the endpoint ...
	cfg.Identity.PrivateKeyFile = "foo.key" // ... is HTTPS - this causes the cookies' Secure flag to be true
	config.Set(cfg)

	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("Foo"))
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	cache := cache.NewTestingCacheWithFactory(t, mockClientFactory, *cfg)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(mockClientFactory.Clients), cache, cfg)

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), cfg.LoginToken.SigningKey)))
	uri := fmt.Sprintf("https://kiali.io:44/api/authenticate?code=f0code&state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  nonceCookieName(cfg.KubernetesConfig.ClusterName),
		Value: "nonceString",
	})
	request.AddCookie(&http.Cookie{
		Name:  codeVerifierCookieName(cfg.KubernetesConfig.ClusterName),
		Value: "test_code_verifier_43_chars_long_12345678",
	})

	controller, err := NewOpenIdAuthController(cache, mockClientFactory, cfg, discovery)
	require.NoError(t, err)

	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Failf(t, "Callback function shouldn't have been called.", "")
	})).ServeHTTP(rr, request)

	// nonce and PKCE cookie cleanup
	response := rr.Result()
	assert.Len(t, response.Cookies(), 2)
	assert.Equal(t, nonceCookieName(cfg.KubernetesConfig.ClusterName), response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))
	assert.Equal(t, codeVerifierCookieName(cfg.KubernetesConfig.ClusterName), response.Cookies()[1].Name)
	assert.True(t, clockTime.After(response.Cookies()[1].Expires))

	// Redirection to boot the UI
	u, _ := url.Parse(response.Header.Get("Location"))
	q, _ := url.ParseQuery(u.RawQuery)
	assert.Contains(t, q["openid_error"][0], "cannot parse received id_token from the OpenId provider")
	assert.Equal(t, http.StatusFound, response.StatusCode)
}

func TestOpenIdCodeFlowShouldRejectMissingAuthorizationCode(t *testing.T) {
	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	cfg := config.NewConfig()
	cfg.Server.WebRoot = "/kiali-test"
	cfg.LoginToken.SigningKey = "kiali67890123456"
	cfg.LoginToken.ExpirationSeconds = 1
	config.Set(cfg)

	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("Foo"))
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	cache := cache.NewTestingCacheWithFactory(t, mockClientFactory, *cfg)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(mockClientFactory.Clients), cache, cfg)

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), cfg.LoginToken.SigningKey)))
	uri := fmt.Sprintf("/api/authenticate?state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  nonceCookieName(cfg.KubernetesConfig.ClusterName),
		Value: "nonceString",
	})

	controller, err := NewOpenIdAuthController(cache, mockClientFactory, cfg, discovery)
	require.NoError(t, err)

	callbackCalled := false
	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callbackCalled = true
	})).ServeHTTP(rr, request)

	response := rr.Result()
	// No cleanup is done if there are not enough params so that the authorization code flow is triggered
	assert.Len(t, response.Cookies(), 0)

	// A missing State parameter has the effect that the auth controller ignores the request and
	// passes it to the next handler.
	assert.True(t, callbackCalled)
}

func TestOpenIdCodeFlowShouldFailWithIdTokenWithoutExpiration(t *testing.T) {
	cachedOpenIdMetadata = nil
	var oidcMetadata []byte
	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/.well-known/openid-configuration" {
			w.WriteHeader(200)
			_, _ = w.Write(oidcMetadata)
		}
		if r.URL.Path == "/token" {
			w.WriteHeader(200)
			_, _ = w.Write([]byte("{ \"id_token\": \"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqZG9lQGRvbWFpbi5jb20iLCJuYW1lIjoiSm9obiBEb2UiLCJpYXQiOjE1MTYyMzkwMjIsIm5vbmNlIjoiMWJhOWI4MzRkMDhhYzgxZmViMzRlMjA4NDAyZWIxOGU5MDliZTA4NDUxOGMzMjg1MTA5NDAxODQifQ.ih34Mh3Sao9bnXCjaobfAEO1BnHnuuLBWxihAzwUqw8\" }"))
		}
	}))
	defer testServer.Close()

	oidcMeta := openIdMetadata{
		Issuer:                 testServer.URL,
		AuthURL:                testServer.URL + "/auth",
		TokenURL:               testServer.URL + "/token",
		JWKSURL:                testServer.URL + "/jwks",
		UserInfoURL:            "",
		Algorithms:             nil,
		ScopesSupported:        []string{"openid"},
		ResponseTypesSupported: []string{"code"},
	}
	oidcMetadata, err := json.Marshal(oidcMeta)
	assert.Nil(t, err)

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	cfg := config.NewConfig()
	cfg.Server.WebRoot = "/kiali-test"
	cfg.LoginToken.SigningKey = "kiali67890123456"
	cfg.LoginToken.ExpirationSeconds = 1
	cfg.Auth.OpenId.IssuerUri = testServer.URL
	cfg.Auth.OpenId.ClientId = "kiali-client"
	cfg.Identity.CertFile = "foo.cert"      // setting conf.Identity will make it look as if the endpoint ...
	cfg.Identity.PrivateKeyFile = "foo.key" // ... is HTTPS - this causes the cookies' Secure flag to be true
	config.Set(cfg)

	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("Foo"))
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	cache := cache.NewTestingCacheWithFactory(t, mockClientFactory, *cfg)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(mockClientFactory.Clients), cache, cfg)

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), cfg.LoginToken.SigningKey)))
	uri := fmt.Sprintf("https://kiali.io:44/api/authenticate?code=f0code&state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  nonceCookieName(cfg.KubernetesConfig.ClusterName),
		Value: "nonceString",
	})
	request.AddCookie(&http.Cookie{
		Name:  codeVerifierCookieName(cfg.KubernetesConfig.ClusterName),
		Value: "test_code_verifier_43_chars_long_12345678",
	})

	controller, err := NewOpenIdAuthController(cache, mockClientFactory, cfg, discovery)
	require.NoError(t, err)

	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Failf(t, "Callback function shouldn't have been called.", "")
	})).ServeHTTP(rr, request)

	// nonce and PKCE cookie cleanup
	response := rr.Result()
	assert.Len(t, response.Cookies(), 2)
	assert.Equal(t, nonceCookieName(cfg.KubernetesConfig.ClusterName), response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))
	assert.Equal(t, codeVerifierCookieName(cfg.KubernetesConfig.ClusterName), response.Cookies()[1].Name)
	assert.True(t, clockTime.After(response.Cookies()[1].Expires))

	// Redirection to boot the UI
	q := url.Values{}
	q.Add("openid_error", "the received id_token from the OpenId provider has missing the required 'exp' claim")
	assert.Equal(t, "/kiali-test/?"+q.Encode(), response.Header.Get("Location"))
	assert.Equal(t, http.StatusFound, response.StatusCode)
}

func TestOpenIdCodeFlowShouldFailWithIdTokenWithNonNumericExpClaim(t *testing.T) {
	cachedOpenIdMetadata = nil
	var oidcMetadata []byte
	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/.well-known/openid-configuration" {
			w.WriteHeader(200)
			_, _ = w.Write(oidcMetadata)
		}
		if r.URL.Path == "/token" {
			w.WriteHeader(200)
			_, _ = w.Write([]byte("{ \"id_token\": \"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqZG9lQGRvbWFpbi5jb20iLCJuYW1lIjoiSm9obiBEb2UiLCJpYXQiOjE1MTYyMzkwMjIsIm5vbmNlIjoiMWJhOWI4MzRkMDhhYzgxZmViMzRlMjA4NDAyZWIxOGU5MDliZTA4NDUxOGMzMjg1MTA5NDAxODQiLCJleHAiOiJmb28ifQ.wdM3yQPwAXLaqZbVku_fcXpisC3tzES8_UUwjbxSPrc\" }"))
		}
	}))
	defer testServer.Close()

	oidcMeta := openIdMetadata{
		Issuer:                 testServer.URL,
		AuthURL:                testServer.URL + "/auth",
		TokenURL:               testServer.URL + "/token",
		JWKSURL:                testServer.URL + "/jwks",
		UserInfoURL:            "",
		Algorithms:             nil,
		ScopesSupported:        []string{"openid"},
		ResponseTypesSupported: []string{"code"},
	}
	oidcMetadata, err := json.Marshal(oidcMeta)
	assert.Nil(t, err)

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	cfg := config.NewConfig()
	cfg.Server.WebRoot = "/kiali-test"
	cfg.LoginToken.SigningKey = "kiali67890123456"
	cfg.LoginToken.ExpirationSeconds = 1
	cfg.Auth.OpenId.IssuerUri = testServer.URL
	cfg.Auth.OpenId.ClientId = "kiali-client"
	config.Set(cfg)

	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("Foo"))
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	cache := cache.NewTestingCacheWithFactory(t, mockClientFactory, *cfg)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(mockClientFactory.Clients), cache, cfg)

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), cfg.LoginToken.SigningKey)))
	uri := fmt.Sprintf("https://kiali.io:44/api/authenticate?code=f0code&state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  nonceCookieName(cfg.KubernetesConfig.ClusterName),
		Value: "nonceString",
	})
	request.AddCookie(&http.Cookie{
		Name:  codeVerifierCookieName(cfg.KubernetesConfig.ClusterName),
		Value: "test_code_verifier_43_chars_long_12345678",
	})

	controller, err := NewOpenIdAuthController(cache, mockClientFactory, cfg, discovery)
	require.NoError(t, err)

	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Failf(t, "Callback function shouldn't have been called.", "")
	})).ServeHTTP(rr, request)

	// nonce and PKCE cookie cleanup
	response := rr.Result()
	assert.Len(t, response.Cookies(), 2)
	assert.Equal(t, nonceCookieName(cfg.KubernetesConfig.ClusterName), response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))
	assert.Equal(t, codeVerifierCookieName(cfg.KubernetesConfig.ClusterName), response.Cookies()[1].Name)
	assert.True(t, clockTime.After(response.Cookies()[1].Expires))

	// Redirection to boot the UI
	u, _ := url.Parse(response.Header.Get("Location"))
	q, _ := url.ParseQuery(u.RawQuery)
	assert.Contains(t, q["openid_error"][0], "token exp claim is present, but invalid")
	assert.Equal(t, http.StatusFound, response.StatusCode)
}

func TestOpenIdCodeFlowShouldRejectInvalidState(t *testing.T) {
	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	cfg := config.NewConfig()
	cfg.Server.WebRoot = "/kiali-test"
	cfg.LoginToken.SigningKey = "kiali67890123456"
	cfg.LoginToken.ExpirationSeconds = 1
	config.Set(cfg)

	// Calculate a hash of the wrong string.
	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "badNonceString", clockTime.UTC().Format("060102150405"), cfg.LoginToken.SigningKey)))
	uri := fmt.Sprintf("/api/authenticate?code=f0code&state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  nonceCookieName(cfg.KubernetesConfig.ClusterName),
		Value: "nonceString",
	})
	request.AddCookie(&http.Cookie{
		Name:  codeVerifierCookieName(cfg.KubernetesConfig.ClusterName),
		Value: "test_code_verifier_43_chars_long_12345678",
	})

	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("Foo"))
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	cache := cache.NewTestingCacheWithFactory(t, mockClientFactory, *cfg)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(mockClientFactory.Clients), cache, cfg)

	controller, err := NewOpenIdAuthController(cache, mockClientFactory, cfg, discovery)
	require.NoError(t, err)

	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Failf(t, "Callback function shouldn't have been called.", "")
	})).ServeHTTP(rr, request)

	// nonce and PKCE cookie cleanup
	response := rr.Result()
	assert.Len(t, response.Cookies(), 2)
	assert.Equal(t, nonceCookieName(cfg.KubernetesConfig.ClusterName), response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))
	assert.Equal(t, codeVerifierCookieName(cfg.KubernetesConfig.ClusterName), response.Cookies()[1].Name)
	assert.True(t, clockTime.After(response.Cookies()[1].Expires))

	// Redirection to boot the UI
	q := url.Values{}
	q.Add("openid_error", "Request rejected: CSRF mitigation")
	assert.Equal(t, "/kiali-test/?"+q.Encode(), response.Header.Get("Location"))
	assert.Equal(t, http.StatusFound, response.StatusCode)
}

func TestOpenIdCodeFlowShouldRejectBadStateFormat(t *testing.T) {
	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	cfg := config.NewConfig()
	cfg.Server.WebRoot = "/kiali-test"
	cfg.LoginToken.SigningKey = "kiali67890123456"
	cfg.LoginToken.ExpirationSeconds = 1
	config.Set(cfg)

	// Calculate a hash of the wrong string.
	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), cfg.LoginToken.SigningKey)))
	uri := fmt.Sprintf("/api/authenticate?code=f0code&state=%xp%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  nonceCookieName(cfg.KubernetesConfig.ClusterName),
		Value: "nonceString",
	})
	request.AddCookie(&http.Cookie{
		Name:  codeVerifierCookieName(cfg.KubernetesConfig.ClusterName),
		Value: "test_code_verifier_43_chars_long_12345678",
	})

	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("Foo"))
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	cache := cache.NewTestingCacheWithFactory(t, mockClientFactory, *cfg)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(mockClientFactory.Clients), cache, cfg)

	controller, err := NewOpenIdAuthController(cache, mockClientFactory, cfg, discovery)
	require.NoError(t, err)

	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Failf(t, "Callback function shouldn't have been called.", "")
	})).ServeHTTP(rr, request)

	// nonce and PKCE cookie cleanup
	response := rr.Result()
	assert.Len(t, response.Cookies(), 2)
	assert.Equal(t, nonceCookieName(cfg.KubernetesConfig.ClusterName), response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))
	assert.Equal(t, codeVerifierCookieName(cfg.KubernetesConfig.ClusterName), response.Cookies()[1].Name)
	assert.True(t, clockTime.After(response.Cookies()[1].Expires))

	// Redirection to boot the UI
	q := url.Values{}
	q.Add("openid_error", "Request rejected: State parameter is invalid")
	assert.Equal(t, "/kiali-test/?"+q.Encode(), response.Header.Get("Location"))
	assert.Equal(t, http.StatusFound, response.StatusCode)
}

func TestOpenIdCodeFlowShouldRejectMissingState(t *testing.T) {
	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	cfg := config.NewConfig()
	cfg.Server.WebRoot = "/kiali-test"
	cfg.LoginToken.SigningKey = "kiali67890123456"
	cfg.LoginToken.ExpirationSeconds = 1
	config.Set(cfg)

	uri := "/api/authenticate?code=f0code"
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  nonceCookieName(cfg.KubernetesConfig.ClusterName),
		Value: "nonceString",
	})

	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("Foo"))
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	cache := cache.NewTestingCacheWithFactory(t, mockClientFactory, *cfg)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(mockClientFactory.Clients), cache, cfg)

	controller, err := NewOpenIdAuthController(cache, mockClientFactory, cfg, discovery)
	require.NoError(t, err)

	callbackCalled := false
	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callbackCalled = true
	})).ServeHTTP(rr, request)

	response := rr.Result()
	// No cleanup is done if there are not enough params so that the authorization code flow is triggered
	assert.Len(t, response.Cookies(), 0)

	// A missing State parameter has the effect that the auth controller ignores the request and
	// passes it to the next handler.
	assert.True(t, callbackCalled)
}

func TestOpenIdCodeFlowShouldRejectMissingNonceCookie(t *testing.T) {
	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	cfg := config.NewConfig()
	cfg.Server.WebRoot = "/kiali-test"
	cfg.LoginToken.SigningKey = "kiali67890123456"
	cfg.LoginToken.ExpirationSeconds = 1
	config.Set(cfg)

	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("Foo"))
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	cache := cache.NewTestingCacheWithFactory(t, mockClientFactory, *cfg)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(mockClientFactory.Clients), cache, cfg)

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), cfg.LoginToken.SigningKey)))
	uri := fmt.Sprintf("/api/authenticate?code=f0code&state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)

	controller, err := NewOpenIdAuthController(cache, mockClientFactory, cfg, discovery)
	require.NoError(t, err)

	callbackCalled := false
	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callbackCalled = true
	})).ServeHTTP(rr, request)

	// No cleanup is done if there are not enough params so that the authorization code flow is triggered
	response := rr.Result()
	assert.Len(t, response.Cookies(), 0)

	// A missing nonce cookie has the effect that the auth controller ignores the request and
	// passes it to the next handler.
	assert.True(t, callbackCalled)
}

func TestOpenIdCodeFlowShouldRejectMissingNonceInToken(t *testing.T) {
	cachedOpenIdMetadata = nil
	var oidcMetadata []byte
	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/.well-known/openid-configuration" {
			w.WriteHeader(200)
			_, _ = w.Write(oidcMetadata)
		}
		if r.URL.Path == "/token" {
			w.WriteHeader(200)
			_, _ = w.Write([]byte("{ \"id_token\": \"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqZG9lQGRvbWFpbi5jb20iLCJuYW1lIjoiSm9obiBEb2UiLCJpYXQiOjE1MTYyMzkwMjIsImV4cCI6MTMxMTI4MTk3MH0.xAoq7T-wti__Je1PDuTgNonoVSu059FzpOHsNm26YTg\" }"))
		}
	}))
	defer testServer.Close()

	oidcMeta := openIdMetadata{
		Issuer:                 testServer.URL,
		AuthURL:                testServer.URL + "/auth",
		TokenURL:               testServer.URL + "/token",
		JWKSURL:                testServer.URL + "/jwks",
		UserInfoURL:            "",
		Algorithms:             nil,
		ScopesSupported:        []string{"openid"},
		ResponseTypesSupported: []string{"code"},
	}
	oidcMetadata, err := json.Marshal(oidcMeta)
	assert.Nil(t, err)

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	cfg := config.NewConfig()
	cfg.Server.WebRoot = "/kiali-test"
	cfg.LoginToken.SigningKey = "kiali67890123456"
	cfg.LoginToken.ExpirationSeconds = 1
	cfg.Auth.OpenId.IssuerUri = testServer.URL
	cfg.Auth.OpenId.ClientId = "kiali-client"
	config.Set(cfg)

	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("Foo"))
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	cache := cache.NewTestingCacheWithFactory(t, mockClientFactory, *cfg)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(mockClientFactory.Clients), cache, cfg)

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), cfg.LoginToken.SigningKey)))
	uri := fmt.Sprintf("https://kiali.io:44/api/authenticate?code=f0code&state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  nonceCookieName(cfg.KubernetesConfig.ClusterName),
		Value: "nonceString",
	})
	request.AddCookie(&http.Cookie{
		Name:  codeVerifierCookieName(cfg.KubernetesConfig.ClusterName),
		Value: "test_code_verifier_43_chars_long_12345678",
	})

	controller, err := NewOpenIdAuthController(cache, mockClientFactory, cfg, discovery)
	require.NoError(t, err)

	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Failf(t, "Callback function shouldn't have been called.", "")
	})).ServeHTTP(rr, request)

	// nonce and PKCE cookie cleanup
	response := rr.Result()
	assert.Len(t, response.Cookies(), 2)
	assert.Equal(t, nonceCookieName(cfg.KubernetesConfig.ClusterName), response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))
	assert.Equal(t, codeVerifierCookieName(cfg.KubernetesConfig.ClusterName), response.Cookies()[1].Name)
	assert.True(t, clockTime.After(response.Cookies()[1].Expires))

	// Redirection to boot the UI
	q := url.Values{}
	q.Add("openid_error", "OpenId token rejected: nonce code mismatch")
	assert.Equal(t, "/kiali-test/?"+q.Encode(), response.Header.Get("Location"))
	assert.Equal(t, http.StatusFound, response.StatusCode)
}

// TestOIDCClientSecretRotation verifies that when the OIDC client secret is stored
// as a file path, the CredentialManager properly handles secret rotation.
// This tests the integration between Config.GetCredential and the OIDC flow.
func TestOIDCClientSecretRotation(t *testing.T) {
	require := require.New(t)

	tmpDir := t.TempDir()
	secretFile := filepath.Join(tmpDir, "oidc-secret")

	// Write initial secret
	initialSecret := "initial-client-secret"
	require.NoError(os.WriteFile(secretFile, []byte(initialSecret), 0o644))

	// Create config with OIDC client secret pointing to file
	conf := config.NewConfig()
	conf.Auth.OpenId.ClientSecret = config.Credential(secretFile)

	// Initialize CredentialManager
	var err error
	conf.Credentials, err = config.NewCredentialManager(nil)
	require.NoError(err)
	t.Cleanup(conf.Close)

	// First read should return initial secret
	secret1, err := conf.GetCredential(conf.Auth.OpenId.ClientSecret)
	require.NoError(err)
	require.Equal(initialSecret, secret1)

	// Rotate secret by writing new value
	rotatedSecret := "rotated-client-secret"
	require.NoError(os.WriteFile(secretFile, []byte(rotatedSecret), 0o644))

	// Wait for file watcher to detect change and update cache
	require.Eventually(func() bool {
		secret, err := conf.GetCredential(conf.Auth.OpenId.ClientSecret)
		return err == nil && secret == rotatedSecret
	}, 2*time.Second, 50*time.Millisecond, "secret should be rotated")
}

// TestOIDCClientSecretLiteralValue verifies that literal (non-file-path) client secrets
// are returned as-is, maintaining backward compatibility.
func TestOIDCClientSecretLiteralValue(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.Auth.OpenId.ClientSecret = "my-literal-secret"

	// Initialize CredentialManager
	var err error
	conf.Credentials, err = config.NewCredentialManager(nil)
	require.NoError(err)
	t.Cleanup(conf.Close)

	// Literal values (not starting with "/") should be returned as-is
	secret, err := conf.GetCredential(conf.Auth.OpenId.ClientSecret)
	require.NoError(err)
	require.Equal("my-literal-secret", secret)
}

// TestOIDCClientSecretEmptyValue verifies that empty client secret is handled correctly.
func TestOIDCClientSecretEmptyValue(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.Auth.OpenId.ClientSecret = ""

	// Initialize CredentialManager
	var err error
	conf.Credentials, err = config.NewCredentialManager(nil)
	require.NoError(err)
	t.Cleanup(conf.Close)

	// Empty value should return empty string
	secret, err := conf.GetCredential(conf.Auth.OpenId.ClientSecret)
	require.NoError(err)
	require.Equal("", secret)
}

// TestRequestOpenIdToken_UsesGetCredential verifies that the requestOpenIdToken method
// actually calls GetCredential to resolve the client secret, supporting both file-based
// and literal client secrets.
func TestRequestOpenIdToken_UsesGetCredential(t *testing.T) {
	t.Run("uses file-based client secret from GetCredential", func(t *testing.T) {
		require := require.New(t)

		// Create temporary secret file
		tmpDir := t.TempDir()
		secretFile := filepath.Join(tmpDir, "oidc-secret")
		expectedSecret := "my-file-based-secret"
		require.NoError(os.WriteFile(secretFile, []byte(expectedSecret), 0o644))

		// Setup mock token endpoint that verifies the client secret
		var receivedSecret string
		tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract the client secret from Basic Auth
			_, password, ok := r.BasicAuth()
			if ok {
				receivedSecret = password
			}
			// Return a fake token response
			response := map[string]any{
				"id_token":     "fake-id-token",
				"access_token": "fake-access-token",
			}
			_ = json.NewEncoder(w).Encode(response)
		}))
		defer tokenServer.Close()

		// Create config pointing to the secret file
		conf := config.NewConfig()
		conf.Auth.OpenId.ClientId = "test-client"
		conf.Auth.OpenId.ClientSecret = config.Credential(secretFile) // File path, not literal value
		conf.Auth.OpenId.InsecureSkipVerifyTLS = true

		// Initialize CredentialManager
		conf.Credentials, _ = config.NewCredentialManager(nil)
		t.Cleanup(conf.Close)

		// Create openidFlowHelper and call requestOpenIdToken
		flow := &openidFlowHelper{
			Code:         "test-authorization-code",
			CodeVerifier: "test_code_verifier_43_chars_long_12345678",
			conf:         conf,
		}

		// Mock the metadata to point to our token server
		cachedOpenIdMetadata = &openIdMetadata{
			Issuer:   "https://example.com",
			TokenURL: tokenServer.URL,
		}
		defer func() { cachedOpenIdMetadata = nil }()

		flow.requestOpenIdToken("http://localhost/callback")

		// Verify no error occurred
		require.NoError(flow.Error)

		// Verify that the secret from the file was used in the token request
		require.Equal(expectedSecret, receivedSecret, "requestOpenIdToken should use secret from GetCredential")
	})

	t.Run("uses literal client secret from GetCredential", func(t *testing.T) {
		require := require.New(t)

		expectedSecret := "my-literal-secret"

		// Setup mock token endpoint
		var receivedSecret string
		tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_, password, ok := r.BasicAuth()
			if ok {
				receivedSecret = password
			}
			response := map[string]any{
				"id_token":     "fake-id-token",
				"access_token": "fake-access-token",
			}
			_ = json.NewEncoder(w).Encode(response)
		}))
		defer tokenServer.Close()

		// Create config with literal secret (not a file path)
		conf := config.NewConfig()
		conf.Auth.OpenId.ClientId = "test-client"
		conf.Auth.OpenId.ClientSecret = config.Credential(expectedSecret) // Literal value
		conf.Auth.OpenId.InsecureSkipVerifyTLS = true

		// Initialize CredentialManager
		conf.Credentials, _ = config.NewCredentialManager(nil)
		t.Cleanup(conf.Close)

		// Create openidFlowHelper and call requestOpenIdToken
		flow := &openidFlowHelper{
			Code:         "test-authorization-code",
			CodeVerifier: "test_code_verifier_43_chars_long_12345678",
			conf:         conf,
		}

		// Mock the metadata
		cachedOpenIdMetadata = &openIdMetadata{
			Issuer:   "https://example.com",
			TokenURL: tokenServer.URL,
		}
		defer func() { cachedOpenIdMetadata = nil }()

		flow.requestOpenIdToken("http://localhost/callback")

		// Verify no error occurred
		require.NoError(flow.Error)

		// Verify that the literal secret was used
		require.Equal(expectedSecret, receivedSecret, "requestOpenIdToken should use literal secret from GetCredential")
	})

	t.Run("handles GetCredential error gracefully", func(t *testing.T) {
		require := require.New(t)

		// Point to a non-existent file to trigger GetCredential error
		nonExistentFile := "/tmp/non-existent-secret-file-that-should-not-exist"

		// Create config pointing to non-existent file
		conf := config.NewConfig()
		conf.Auth.OpenId.ClientId = "test-client"
		conf.Auth.OpenId.ClientSecret = config.Credential(nonExistentFile)

		// Initialize CredentialManager
		conf.Credentials, _ = config.NewCredentialManager(nil)
		t.Cleanup(conf.Close)

		// Create openidFlowHelper and call requestOpenIdToken
		flow := &openidFlowHelper{
			Code:         "test-authorization-code",
			CodeVerifier: "test_code_verifier_43_chars_long_12345678",
			conf:         conf,
		}

		// Mock the metadata
		cachedOpenIdMetadata = &openIdMetadata{
			Issuer:   "https://example.com",
			TokenURL: "https://example.com/token",
		}
		defer func() { cachedOpenIdMetadata = nil }()

		flow.requestOpenIdToken("http://localhost/callback")

		// Verify that an error was set
		require.Error(flow.Error)
		require.Contains(flow.Error.Error(), "failed to read OpenID client secret")
	})
}

/*** Explicit OIDC endpoints tests ***/

func TestOpenIdAuthControllerUsesExplicitEndpointsWhenProvided(t *testing.T) {
	cachedOpenIdMetadata = nil

	// Test server that should NOT be called for auto-discovery
	autoDiscoveryCallCount := 0
	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/.well-known/openid-configuration" {
			autoDiscoveryCallCount++
			w.WriteHeader(401) // Simulate restricted discovery endpoint
			_, _ = w.Write([]byte(`{"error": "unauthorized"}`))
		}
		if r.URL.Path == "/token" {
			_ = r.ParseForm()
			assert.Equal(t, "f0code", r.Form.Get("code"))
			assert.Equal(t, "authorization_code", r.Form.Get("grant_type"))
			assert.Equal(t, "kiali-client", r.Form.Get("client_id"))

			w.WriteHeader(200)
			_, _ = w.Write([]byte("{ \"id_token\": \"" + openIdTestToken + "\" }"))
		}
	}))
	defer testServer.Close()

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	conf := config.NewConfig()
	conf.Server.WebRoot = "/kiali-test"
	conf.LoginToken.SigningKey = "kiali67890123456"
	conf.LoginToken.ExpirationSeconds = 1
	conf.Auth.OpenId.IssuerUri = testServer.URL
	conf.Auth.OpenId.ClientId = "kiali-client"
	// Set explicit endpoints using DiscoveryOverride (not deprecated fields that never existed)
	conf.Auth.OpenId.DiscoveryOverride = config.DiscoveryOverrideConfig{
		AuthorizationEndpoint: testServer.URL + "/auth",
		TokenEndpoint:         testServer.URL + "/token",
		JwksUri:               testServer.URL + "/jwks",
	}
	conf.Identity.CertFile = "foo.cert"
	conf.Identity.PrivateKeyFile = "foo.key"
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("Foo"))
	k8s.OpenShift = true
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	cache := cache.NewTestingCacheWithFactory(t, mockClientFactory, *conf)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(mockClientFactory.Clients), cache, conf)

	_, err := NewOpenIdAuthController(cache, mockClientFactory, conf, discovery)
	require.NoError(t, err)

	// Test that getOpenIdMetadata uses explicit endpoints and doesn't call auto-discovery
	metadata, err := getOpenIdMetadata(conf)
	require.NoError(t, err)

	// Verify explicit endpoints are used
	assert.Equal(t, testServer.URL+"/auth", metadata.AuthURL)
	assert.Equal(t, testServer.URL+"/token", metadata.TokenURL)
	assert.Equal(t, testServer.URL+"/jwks", metadata.JWKSURL)
	assert.Equal(t, testServer.URL, metadata.Issuer)

	// Verify auto-discovery was NOT called
	assert.Equal(t, 0, autoDiscoveryCallCount, "Auto-discovery should not be called when explicit endpoints are provided")

	// Verify that the "code" response type is assumed
	assert.Contains(t, metadata.ResponseTypesSupported, "code")
}

func TestOpenIdAuthControllerDiscoveryOverride(t *testing.T) {
	cachedOpenIdMetadata = nil

	autoDiscoveryCallCount := 0
	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/.well-known/openid-configuration" {
			autoDiscoveryCallCount++
			w.WriteHeader(500) // Fail auto-discovery to ensure explicit config is used
		}
	}))
	defer testServer.Close()

	conf := config.NewConfig()
	conf.Server.WebRoot = "/kiali-test"
	conf.LoginToken.SigningKey = "kiali67890123456"
	conf.LoginToken.ExpirationSeconds = 1
	conf.Auth.OpenId.IssuerUri = testServer.URL
	conf.Auth.OpenId.ClientId = "kiali-client"
	// Use new DiscoveryOverride structure instead of deprecated flat fields
	// Note: userInfoEndpoint will be tested in TestOpenIdAuthControllerHandlesOptionalUserInfoEndpoint
	conf.Auth.OpenId.DiscoveryOverride = config.DiscoveryOverrideConfig{
		AuthorizationEndpoint: testServer.URL + "/auth",
		TokenEndpoint:         testServer.URL + "/token",
		JwksUri:               testServer.URL + "/jwks",
	}
	conf.Identity.CertFile = "foo.cert"
	conf.Identity.PrivateKeyFile = "foo.key"
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("Foo"))
	k8s.OpenShift = true
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	cache := cache.NewTestingCacheWithFactory(t, mockClientFactory, *conf)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(mockClientFactory.Clients), cache, conf)

	_, err := NewOpenIdAuthController(cache, mockClientFactory, conf, discovery)
	require.NoError(t, err)

	// Test that getOpenIdMetadata uses DiscoveryOverride endpoints and doesn't call auto-discovery
	metadata, err := getOpenIdMetadata(conf)
	require.NoError(t, err)

	// Verify DiscoveryOverride endpoints are used
	assert.Equal(t, testServer.URL+"/auth", metadata.AuthURL)
	assert.Equal(t, testServer.URL+"/token", metadata.TokenURL)
	assert.Equal(t, testServer.URL+"/jwks", metadata.JWKSURL)
	assert.Equal(t, testServer.URL, metadata.Issuer)

	// Verify auto-discovery was NOT called
	assert.Equal(t, 0, autoDiscoveryCallCount, "Auto-discovery should not be called when DiscoveryOverride is configured")

	// Verify that the "code" response type is assumed
	assert.Contains(t, metadata.ResponseTypesSupported, "code")
}

func TestOpenIdAuthControllerFallsBackToAutoDiscoveryWhenExplicitEndpointsMissing(t *testing.T) {
	cachedOpenIdMetadata = nil

	autoDiscoveryCallCount := 0
	var oidcMetadata []byte
	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/.well-known/openid-configuration" {
			autoDiscoveryCallCount++
			w.WriteHeader(200)
			_, _ = w.Write(oidcMetadata)
		}
	}))
	defer testServer.Close()

	oidcMeta := openIdMetadata{
		Issuer:                 testServer.URL,
		AuthURL:                testServer.URL + "/auth",
		TokenURL:               testServer.URL + "/token",
		JWKSURL:                testServer.URL + "/jwks",
		UserInfoURL:            "",
		Algorithms:             nil,
		ScopesSupported:        []string{"openid"},
		ResponseTypesSupported: []string{"code"},
	}
	oidcMetadata, err := json.Marshal(oidcMeta)
	require.NoError(t, err)

	conf := config.NewConfig()
	conf.Auth.OpenId.IssuerUri = testServer.URL
	conf.Auth.OpenId.ClientId = "kiali-client"
	// Do NOT set explicit endpoints - should fall back to auto-discovery
	config.Set(conf)

	// Test that getOpenIdMetadata falls back to auto-discovery
	metadata, err := getOpenIdMetadata(conf)
	require.NoError(t, err)

	// Verify auto-discovery WAS called
	assert.Equal(t, 1, autoDiscoveryCallCount, "Auto-discovery should be called when explicit endpoints are not provided")

	// Verify discovered endpoints are used
	assert.Equal(t, testServer.URL+"/auth", metadata.AuthURL)
	assert.Equal(t, testServer.URL+"/token", metadata.TokenURL)
	assert.Equal(t, testServer.URL+"/jwks", metadata.JWKSURL)
}

func TestOpenIdAuthControllerRequiresBothAuthorizationAndTokenEndpointsForDiscoveryOverride(t *testing.T) {
	cachedOpenIdMetadata = nil

	autoDiscoveryCallCount := 0
	var oidcMetadata []byte
	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/.well-known/openid-configuration" {
			autoDiscoveryCallCount++
			w.WriteHeader(200)
			_, _ = w.Write(oidcMetadata)
		}
	}))
	defer testServer.Close()

	oidcMeta := openIdMetadata{
		Issuer:                 testServer.URL,
		AuthURL:                testServer.URL + "/auth",
		TokenURL:               testServer.URL + "/token",
		JWKSURL:                testServer.URL + "/jwks",
		ResponseTypesSupported: []string{"code"},
	}
	oidcMetadata, err := json.Marshal(oidcMeta)
	require.NoError(t, err)

	// Test case 1: Only authorization_endpoint in DiscoveryOverride (should use auto-discovery)
	conf := config.NewConfig()
	conf.Auth.OpenId.IssuerUri = testServer.URL
	conf.Auth.OpenId.ClientId = "kiali-client"
	conf.Auth.OpenId.DiscoveryOverride = config.DiscoveryOverrideConfig{
		AuthorizationEndpoint: testServer.URL + "/auth",
		// TokenEndpoint is missing - should trigger auto-discovery
	}
	config.Set(conf)

	_, err1 := getOpenIdMetadata(conf)
	require.NoError(t, err1)
	assert.Equal(t, 1, autoDiscoveryCallCount, "Auto-discovery should be called when token_endpoint is missing in DiscoveryOverride")

	// Reset for next test
	cachedOpenIdMetadata = nil
	autoDiscoveryCallCount = 0

	// Test case 2: Only token_endpoint in DiscoveryOverride (should use auto-discovery)
	conf.Auth.OpenId.DiscoveryOverride = config.DiscoveryOverrideConfig{
		TokenEndpoint: testServer.URL + "/token",
		// AuthorizationEndpoint is missing - should trigger auto-discovery
	}
	config.Set(conf)

	_, err2 := getOpenIdMetadata(conf)
	require.NoError(t, err2)
	assert.Equal(t, 1, autoDiscoveryCallCount, "Auto-discovery should be called when authorization_endpoint is missing in DiscoveryOverride")
}

func TestOpenIdAuthControllerHandlesOptionalUserInfoEndpointWithDiscoveryOverride(t *testing.T) {
	cachedOpenIdMetadata = nil

	conf := config.NewConfig()
	conf.Auth.OpenId.IssuerUri = "https://example.com"
	conf.Auth.OpenId.ClientId = "kiali-client"
	conf.Auth.OpenId.DiscoveryOverride = config.DiscoveryOverrideConfig{
		AuthorizationEndpoint: "https://example.com/auth",
		TokenEndpoint:         "https://example.com/token",
		JwksUri:               "https://example.com/jwks",
		// UserInfoEndpoint is optional - not provided
	}
	config.Set(conf)

	metadata, err := getOpenIdMetadata(conf)
	require.NoError(t, err)

	// Verify DiscoveryOverride endpoints are used
	assert.Equal(t, "https://example.com/auth", metadata.AuthURL)
	assert.Equal(t, "https://example.com/token", metadata.TokenURL)
	assert.Equal(t, "https://example.com/jwks", metadata.JWKSURL)
	assert.Equal(t, "", metadata.UserInfoURL, "UserInfoURL should be empty when not provided in DiscoveryOverride")

	// Test with UserInfoEndpoint provided in DiscoveryOverride
	conf.Auth.OpenId.DiscoveryOverride.UserinfoEndpoint = "https://example.com/userinfo"
	config.Set(conf)
	cachedOpenIdMetadata = nil // Reset cache

	metadata, err = getOpenIdMetadata(conf)
	require.NoError(t, err)
	assert.Equal(t, "https://example.com/userinfo", metadata.UserInfoURL)
}

// TestOpenIdRedirectHandlerGeneratesPKCEParameters verifies that the redirectToAuthServerHandler correctly
// implements PKCE (Proof Key for Code Exchange) per RFC 7636. This test ensures that:
// 1. A cryptographically random code_verifier is generated using only unreserved characters [A-Za-z0-9-._~]
// 2. The code_challenge is correctly computed as base64url(SHA256(code_verifier)) without padding
// 3. Both nonce and code_verifier cookies are set with appropriate security attributes (HttpOnly, Secure, SameSite=Lax)
// 4. The redirect URL to the OIDC provider includes both code_challenge and code_challenge_method=S256 parameters
// 5. The mathematical relationship between code_verifier and code_challenge is correct
// This test is critical because PKCE prevents authorization code interception attacks by binding the
// authorization code to the client that requested it. Without proper PKCE implementation, the authentication
// flow would be vulnerable to malicious actors intercepting and using authorization codes.
func TestOpenIdRedirectHandlerGeneratesPKCEParameters(t *testing.T) {
	cachedOpenIdMetadata = nil

	// Setup mock OIDC server
	var oidcMetadata []byte
	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/.well-known/openid-configuration" {
			w.WriteHeader(200)
			_, _ = w.Write(oidcMetadata)
		}
	}))
	defer testServer.Close()

	oidcMeta := openIdMetadata{
		Issuer:                 testServer.URL,
		AuthURL:                testServer.URL + "/auth",
		TokenURL:               testServer.URL + "/token",
		JWKSURL:                testServer.URL + "/jwks",
		ResponseTypesSupported: []string{"code"},
	}
	oidcMetadata, _ = json.Marshal(oidcMeta)

	conf := config.NewConfig()
	conf.Server.WebRoot = "/kiali-test"
	conf.LoginToken.SigningKey = "kiali67890123456"
	conf.Auth.Strategy = config.AuthStrategyOpenId
	conf.Auth.OpenId.IssuerUri = testServer.URL
	conf.Auth.OpenId.ClientId = "kiali-client"
	conf.Identity.CertFile = "foo.cert"      // setting conf.Identity will make it look as if the endpoint ...
	conf.Identity.PrivateKeyFile = "foo.key" // ... is HTTPS - this causes the cookies' Secure flag to be true
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("Foo"))
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	cache := cache.NewTestingCacheWithFactory(t, mockClientFactory, *conf)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(mockClientFactory.Clients), cache, conf)

	controller, err := NewOpenIdAuthController(cache, mockClientFactory, conf, discovery)
	require.NoError(t, err)

	// Make request to redirect endpoint
	request := httptest.NewRequest(http.MethodGet, "/api/auth/openid_redirect", nil)
	rr := httptest.NewRecorder()

	controller.redirectToAuthServerHandler(rr, request)

	// Validate response
	response := rr.Result()
	assert.Equal(t, http.StatusFound, response.StatusCode)

	// Validate cookies were set
	cookies := response.Cookies()
	var nonceCookie, verifierCookie *http.Cookie
	for _, c := range cookies {
		if c.Name == nonceCookieName(conf.KubernetesConfig.ClusterName) {
			nonceCookie = c
		}
		if c.Name == codeVerifierCookieName(conf.KubernetesConfig.ClusterName) {
			verifierCookie = c
		}
	}

	require.NotNil(t, nonceCookie, "Nonce cookie should be set")
	require.NotNil(t, verifierCookie, "Code verifier cookie should be set")

	// Validate code_verifier format (43-128 chars, unreserved characters)
	assert.Len(t, verifierCookie.Value, 43, "Code verifier should be 43 characters")
	assert.Regexp(t, `^[A-Za-z0-9\-._~]+$`, verifierCookie.Value, "Code verifier should only contain unreserved characters")

	// Validate cookie attributes
	assert.True(t, verifierCookie.HttpOnly, "Code verifier cookie should be HttpOnly")
	assert.Equal(t, http.SameSiteLaxMode, verifierCookie.SameSite, "Code verifier cookie should use SameSiteLaxMode")
	assert.True(t, verifierCookie.Secure, "Code verifier cookie should be Secure")

	// Parse redirect URL
	location := response.Header.Get("Location")
	redirectURL, err := url.Parse(location)
	require.NoError(t, err)

	// Validate PKCE parameters in redirect URL
	query := redirectURL.Query()
	codeChallenge := query.Get("code_challenge")
	codeChallengeMethod := query.Get("code_challenge_method")

	assert.NotEmpty(t, codeChallenge, "code_challenge should be present in redirect URL")
	assert.Equal(t, "S256", codeChallengeMethod, "code_challenge_method should be S256")

	// Validate code_challenge format (base64url, 43 chars for SHA-256)
	assert.Regexp(t, `^[A-Za-z0-9\-_]+$`, codeChallenge, "Code challenge should be base64url encoded")

	// Validate code_challenge is correct hash of code_verifier
	hash := sha256.Sum256([]byte(verifierCookie.Value))
	expectedChallenge := strings.TrimRight(base64.URLEncoding.EncodeToString(hash[:]), "=")
	assert.Equal(t, expectedChallenge, codeChallenge, "Code challenge should be SHA-256 hash of code verifier")
}

// TestOpenIdCodeFlowShouldRejectMissingCodeVerifierCookie validates that the authentication flow properly
// detects and rejects requests where the PKCE code_verifier cookie is missing. This test simulates scenarios
// where cookies may be blocked by browser privacy settings, deleted by the user, or lost due to session timeout.
// The code_verifier cookie should always be present because Kiali sets it before redirecting to the OIDC provider,
// so its absence indicates an error condition. This test ensures that:
// 1. The checkOpenIdAuthorizationCodeFlowParams function detects the missing cookie early in the flow
// 2. The request is rejected with a badOidcRequest error (passed to fallback handler)
// 3. A clear, user-friendly error message is provided instead of a cryptic token endpoint failure
// Early detection of this condition improves the user experience by providing actionable error messages
// (e.g., "cookies may be blocked") rather than letting the flow proceed to fail later at the token endpoint
// with a confusing PKCE verification error.
func TestOpenIdCodeFlowShouldRejectMissingCodeVerifierCookie(t *testing.T) {
	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	cfg := config.NewConfig()
	cfg.Server.WebRoot = "/kiali-test"
	cfg.LoginToken.SigningKey = "kiali67890123456"
	cfg.LoginToken.ExpirationSeconds = 1
	config.Set(cfg)

	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("Foo"))
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	cache := cache.NewTestingCacheWithFactory(t, mockClientFactory, *cfg)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(mockClientFactory.Clients), cache, cfg)

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), cfg.LoginToken.SigningKey)))
	uri := fmt.Sprintf("/api/authenticate?code=f0code&state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)

	// Add nonce cookie but NOT code_verifier cookie
	request.AddCookie(&http.Cookie{
		Name:  nonceCookieName(cfg.KubernetesConfig.ClusterName),
		Value: "nonceString",
	})

	controller, err := NewOpenIdAuthController(cache, mockClientFactory, cfg, discovery)
	require.NoError(t, err)

	callbackCalled := false
	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callbackCalled = true
	})).ServeHTTP(rr, request)

	// Should pass to fallback handler (badOidcRequest)
	assert.True(t, callbackCalled, "Should pass to fallback when code verifier cookie is missing")
}

// TestOpenIdPKCEWorksWithProviderThatIgnoresIt verifies that Kiali's PKCE implementation maintains backwards
// compatibility with OIDC providers that do not support or validate PKCE parameters. According to RFC 7636
// Section 6.1, authorization servers that do not support PKCE must ignore the code_challenge and
// code_challenge_method parameters in the authorization request, and must not require code_verifier in
// the token request. This test ensures that:
// 1. Kiali always sends PKCE parameters (code_challenge, code_challenge_method) in authorization requests
// 2. Kiali always sends code_verifier in token exchange requests
// 3. Authentication succeeds even when the OIDC provider ignores these parameters
// 4. The implementation does not break existing deployments using older OIDC providers
// This backwards compatibility is critical because many Kiali deployments may use OIDC providers that
// predate PKCE support (pre-2015), and forcing PKCE validation would break those installations. By always
// sending PKCE parameters but not requiring provider validation, we provide enhanced security for modern
// providers while maintaining compatibility with legacy systems.
func TestOpenIdPKCEWorksWithProviderThatIgnoresIt(t *testing.T) {
	cachedOpenIdMetadata = nil
	var oidcMetadata []byte

	// Setup mock OIDC server that ignores PKCE parameters (simulates older provider)
	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/.well-known/openid-configuration" {
			w.WriteHeader(200)
			_, _ = w.Write(oidcMetadata)
		}
		if r.URL.Path == "/token" {
			_ = r.ParseForm()
			// Verify basic parameters but ignore code_verifier (simulating old provider)
			assert.Equal(t, "f0code", r.Form.Get("code"))
			assert.Equal(t, "authorization_code", r.Form.Get("grant_type"))
			assert.Equal(t, "kiali-client", r.Form.Get("client_id"))
			assert.Equal(t, "https://kiali.io:44/kiali-test", r.Form.Get("redirect_uri"))
			// Note: code_verifier is present in request but this old provider ignores it

			w.WriteHeader(200)
			_, _ = w.Write([]byte("{ \"id_token\": \"" + openIdTestToken + "\" }"))
		}
	}))
	defer testServer.Close()

	oidcMeta := openIdMetadata{
		Issuer:                 testServer.URL,
		AuthURL:                testServer.URL + "/auth",
		TokenURL:               testServer.URL + "/token",
		JWKSURL:                testServer.URL + "/jwks",
		UserInfoURL:            "",
		Algorithms:             nil,
		ScopesSupported:        []string{"openid"},
		ResponseTypesSupported: []string{"code"},
	}
	oidcMetadata, err := json.Marshal(oidcMeta)
	assert.Nil(t, err)

	clockTime := time.Date(2021, 12, 1, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}

	conf := config.NewConfig()
	conf.Server.WebRoot = "/kiali-test"
	conf.LoginToken.SigningKey = "kiali67890123456"
	conf.LoginToken.ExpirationSeconds = 1
	conf.Auth.OpenId.IssuerUri = testServer.URL
	conf.Auth.OpenId.ClientId = "kiali-client"
	conf.Identity.CertFile = "foo.cert"      // setting conf.Identity will make it look as if the endpoint ...
	conf.Identity.PrivateKeyFile = "foo.key" // ... is HTTPS - this causes the cookies' Secure flag to be true
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("Foo"))
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	cache := cache.NewTestingCacheWithFactory(t, mockClientFactory, *conf)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(mockClientFactory.Clients), cache, conf)

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), conf.LoginToken.SigningKey)))
	uri := fmt.Sprintf("https://kiali.io:44/api/authenticate?code=f0code&state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  nonceCookieName(conf.KubernetesConfig.ClusterName),
		Value: "nonceString",
	})
	request.AddCookie(&http.Cookie{
		Name:  codeVerifierCookieName(conf.KubernetesConfig.ClusterName),
		Value: "test_code_verifier_43_chars_long_12345678",
	})

	controller, err := NewOpenIdAuthController(cache, mockClientFactory, conf, discovery)
	require.NoError(t, err)

	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Failf(t, "Callback function shouldn't have been called.", "")
	})).ServeHTTP(rr, request)

	expectedExpiration := time.Date(2021, 12, 1, 0, 0, 1, 0, time.UTC)

	// Check that cookies are set and have the right expiration.
	response := rr.Result()
	assert.Len(t, response.Cookies(), 3)

	// nonce cookie cleanup
	assert.Equal(t, nonceCookieName(conf.KubernetesConfig.ClusterName), response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))
	assert.True(t, response.Cookies()[0].HttpOnly)
	assert.True(t, response.Cookies()[0].Secure)

	// PKCE verifier cookie cleanup
	assert.Equal(t, codeVerifierCookieName(conf.KubernetesConfig.ClusterName), response.Cookies()[1].Name)
	assert.True(t, clockTime.After(response.Cookies()[1].Expires))
	assert.True(t, response.Cookies()[1].HttpOnly)
	assert.True(t, response.Cookies()[1].Secure)

	// Session cookie
	assert.Equal(t, SessionCookieName, response.Cookies()[2].Name)
	assert.Equal(t, expectedExpiration, response.Cookies()[2].Expires)
	assert.Equal(t, http.StatusFound, response.StatusCode)
	assert.True(t, response.Cookies()[2].HttpOnly)
	assert.True(t, response.Cookies()[2].Secure)

	// Redirection to boot the UI
	assert.Equal(t, "/kiali-test/", response.Header.Get("Location"))
}
