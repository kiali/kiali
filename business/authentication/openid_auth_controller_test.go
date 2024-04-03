package authentication

import (
	"crypto/sha256"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/go-jose/go-jose"
	osproject_v1 "github.com/openshift/api/project/v1"
	"github.com/stretchr/testify/assert"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
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

// see https://github.com/kiali/kiali/issues/6226
func TestVerifyAudienceClaim(t *testing.T) {
	oidCfg := config.OpenIdConfig{
		ClientId: "kiali-client",
	}

	oip := openidFlowHelper{
		IdTokenPayload: map[string]interface{}{},
	}

	oip.IdTokenPayload["aud"] = []interface{}{oidCfg.ClientId}
	err := verifyAudienceClaim(&oip, oidCfg)
	assert.Nil(t, err, "verifyAudienceClaim failed: %v", err)

	oip.IdTokenPayload["aud"] = []string{oidCfg.ClientId}
	err = verifyAudienceClaim(&oip, oidCfg)
	assert.Nil(t, err, "verifyAudienceClaim failed: %v", err)

	oip.IdTokenPayload["aud"] = oidCfg.ClientId
	err = verifyAudienceClaim(&oip, oidCfg)
	assert.Nil(t, err, "verifyAudienceClaim failed: %v", err)

	oip.IdTokenPayload["aud"] = []interface{}{oidCfg.ClientId + "DIFFERENT"}
	err = verifyAudienceClaim(&oip, oidCfg)
	assert.NotNil(t, err, "verifyAudienceClaim should have failed")

	oip.IdTokenPayload["aud"] = []string{oidCfg.ClientId + "DIFFERENT"}
	err = verifyAudienceClaim(&oip, oidCfg)
	assert.NotNil(t, err, "verifyAudienceClaim should have failed")

	oip.IdTokenPayload["aud"] = oidCfg.ClientId + "DIFFERENT"
	err = verifyAudienceClaim(&oip, oidCfg)
	assert.NotNil(t, err, "verifyAudienceClaim should have failed")
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
		if r.URL.Path == "/.well-known/openid-configuration" {
			w.WriteHeader(200)
			_, _ = w.Write(oidcMetadata)
		} else if r.URL.Path == "/jwks" {
			w.WriteHeader(200)
			_, _ = w.Write(jwksResponseBytes)
		} else if r.URL.Path == "/token" {
			_ = r.ParseForm()
			assert.Equal(t, "f0code", r.Form.Get("code"))
			assert.Equal(t, "authorization_code", r.Form.Get("grant_type"))
			assert.Equal(t, "kiali-client", r.Form.Get("client_id"))
			assert.Equal(t, "https://kiali.io:44/kiali-test", r.Form.Get("redirect_uri"))

			w.WriteHeader(200)
			_, _ = w.Write([]byte("{ \"id_token\": \"" + openIdTestTokenToUse + "\" }"))
		}
	}))
	defer testServer.Close()

	// because we have a hardcoded token for this test that is pre-encrypted with the issuer URL, we need to start the server on that same URL
	testServerListenerFixedPort, err := net.Listen("tcp", "127.0.0.1:33333")
	assert.Nil(t, err, "Cannot start test server on fixed port")
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
	k8s := kubetest.NewK8SClientMock()
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	business.SetWithBackends(mockClientFactory, nil)

	k8s.On("GetProjects", "").Return([]osproject_v1.Project{
		{ObjectMeta: meta_v1.ObjectMeta{Name: "Foo"}},
	}, nil)

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))
	uri := fmt.Sprintf("https://kiali.io:44/api/authenticate?code=f0code&state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		if authInfo.Token != openIdTestTokenToUse {
			return nil, errors.New("unexpected token")
		}
		k8sclients := make(map[string]kubernetes.ClientInterface)
		k8sclients[conf.KubernetesConfig.ClusterName] = k8s
		return business.NewWithBackends(k8sclients, k8sclients, nil, nil), nil
	})

	expectedExpiration := time.Date(2021, 12, 1, 0, 0, 1, 0, time.UTC)

	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Failf(t, "Callback function shouldn't have been called.", "")
	})).ServeHTTP(rr, request)

	// Check that cookies are set and have the right expiration.
	response := rr.Result()
	assert.Len(t, response.Cookies(), 2)

	// nonce cookie cleanup
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))
	assert.True(t, response.Cookies()[0].HttpOnly)
	assert.True(t, response.Cookies()[0].Secure) // the test URL is https://kiali.io:44/kiali-test ; https: means it should be Secure

	// Session cookie
	assert.Equal(t, AESSessionCookieName, response.Cookies()[1].Name)
	assert.Equal(t, expectedExpiration, response.Cookies()[1].Expires)
	assert.Equal(t, http.StatusFound, response.StatusCode)
	assert.True(t, response.Cookies()[1].HttpOnly)
	assert.True(t, response.Cookies()[1].Secure) // the test URL is https://kiali.io:44/kiali-test ; https: means it should be Secure

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

	// Check that there is only one cookie (nonce) - the other AES cookie should be missing because the audience claim was bad
	response = rr.Result()
	assert.Len(t, response.Cookies(), 1)
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.Equal(t, "/kiali-test/?openid_error=the+OpenID+token+was+rejected%3A+the+OpenId+token+is+not+targeted+for+Kiali%3B+got+aud+%3D+%27bad-aud-client%27", response.Header.Get("Location"))
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
	k8s := kubetest.NewK8SClientMock()
	k8s.On("GetProjects", "").Return([]osproject_v1.Project{
		{ObjectMeta: meta_v1.ObjectMeta{Name: "Foo"}},
	}, nil)

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))

	requestBody := strings.NewReader(fmt.Sprintf("id_token=%s&state=%x-%s", openIdTestToken, stateHash, clockTime.UTC().Format("060102150405")))
	request := httptest.NewRequest(http.MethodPost, "/api/authenticate", requestBody)
	request.Header.Add("Content-Type", "application/x-www-form-urlencoded")
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		if authInfo.Token != openIdTestToken {
			return nil, errors.New("unexpected token")
		}
		k8sclients := make(map[string]kubernetes.ClientInterface)
		k8sclients[conf.KubernetesConfig.ClusterName] = k8s
		return business.NewWithBackends(k8sclients, k8sclients, nil, nil), nil
	})

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
	k8s := kubetest.NewFakeK8sClient(&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "Foo"}})
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	cache := cache.NewTestingCacheWithFactory(t, mockClientFactory, *conf)
	business.WithKialiCache(cache)
	business.SetWithBackends(mockClientFactory, nil)

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))
	uri := fmt.Sprintf("https://kiali.io:44/api/authenticate?code=f0code&state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		if authInfo.Token != openIdTestToken {
			return nil, errors.New("unexpected token")
		}
		k8sclients := make(map[string]kubernetes.ClientInterface)
		k8sclients[conf.KubernetesConfig.ClusterName] = k8s
		return business.NewWithBackends(k8sclients, k8sclients, nil, nil), nil
	})

	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Failf(t, "Callback function shouldn't have been called.", "")
	})).ServeHTTP(rr, request)

	expectedExpiration := time.Date(2021, 12, 1, 0, 0, 1, 0, time.UTC)

	// Check that cookies are set and have the right expiration.
	response := rr.Result()
	assert.Len(t, response.Cookies(), 2)

	// nonce cookie cleanup
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))
	assert.True(t, response.Cookies()[0].HttpOnly)
	assert.True(t, response.Cookies()[0].Secure)

	// Session cookie
	assert.Equal(t, AESSessionCookieName, response.Cookies()[1].Name)
	assert.Equal(t, expectedExpiration, response.Cookies()[1].Expires)
	assert.Equal(t, http.StatusFound, response.StatusCode)
	assert.True(t, response.Cookies()[1].HttpOnly)
	assert.True(t, response.Cookies()[1].Secure)

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

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))
	uri := fmt.Sprintf("https://kiali.io:44/api/authenticate?code=f0code&state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		assert.Fail(t, "Business layer should not be instantiated")
		return nil, nil
	})

	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Failf(t, "Callback function shouldn't have been called.", "")
	})).ServeHTTP(rr, request)

	// nonce cookie cleanup
	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))

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

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))
	uri := fmt.Sprintf("https://kiali.io:44/api/authenticate?code=f0code&state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		assert.Fail(t, "Business layer should not be instantiated")
		return nil, nil
	})

	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Failf(t, "Callback function shouldn't have been called.", "")
	})).ServeHTTP(rr, request)

	// nonce cookie cleanup
	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))

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

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))
	uri := fmt.Sprintf("https://kiali.io:44/api/authenticate?code=f0code&state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		assert.Fail(t, "Business layer should not be instantiated")
		return nil, nil
	})

	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Failf(t, "Callback function shouldn't have been called.", "")
	})).ServeHTTP(rr, request)

	// nonce cookie cleanup
	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))

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
	config.Set(cfg)

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))
	uri := fmt.Sprintf("https://kiali.io:44/api/authenticate?code=f0code&state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		assert.Fail(t, "Business layer should not be instantiated")
		return nil, nil
	})

	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Failf(t, "Callback function shouldn't have been called.", "")
	})).ServeHTTP(rr, request)

	// nonce cookie cleanup
	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))

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

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))
	uri := fmt.Sprintf("/api/authenticate?state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		assert.Fail(t, "Business layer should not be instantiated")
		return nil, nil
	})

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
	config.Set(cfg)

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))
	uri := fmt.Sprintf("https://kiali.io:44/api/authenticate?code=f0code&state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		assert.Fail(t, "Business layer should not be instantiated")
		return nil, nil
	})

	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Failf(t, "Callback function shouldn't have been called.", "")
	})).ServeHTTP(rr, request)

	// nonce cookie cleanup
	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))

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

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))
	uri := fmt.Sprintf("https://kiali.io:44/api/authenticate?code=f0code&state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		assert.Fail(t, "Business layer should not be instantiated")
		return nil, nil
	})

	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Failf(t, "Callback function shouldn't have been called.", "")
	})).ServeHTTP(rr, request)

	// nonce cookie cleanup
	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))

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
	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "badNonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))
	uri := fmt.Sprintf("/api/authenticate?code=f0code&state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		assert.Fail(t, "Business layer should not be instantiated")
		return nil, nil
	})

	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Failf(t, "Callback function shouldn't have been called.", "")
	})).ServeHTTP(rr, request)

	// nonce cookie cleanup
	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))

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
	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))
	uri := fmt.Sprintf("/api/authenticate?code=f0code&state=%xp%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		assert.Fail(t, "Business layer should not be instantiated")
		return nil, nil
	})

	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Failf(t, "Callback function shouldn't have been called.", "")
	})).ServeHTTP(rr, request)

	// nonce cookie cleanup
	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))

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
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		assert.Fail(t, "Business layer should not be instantiated")
		return nil, nil
	})

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

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))
	uri := fmt.Sprintf("/api/authenticate?code=f0code&state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		assert.Fail(t, "Business layer should not be instantiated")
		return nil, nil
	})

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

	stateHash := sha256.Sum224([]byte(fmt.Sprintf("%s+%s+%s", "nonceString", clockTime.UTC().Format("060102150405"), config.GetSigningKey())))
	uri := fmt.Sprintf("https://kiali.io:44/api/authenticate?code=f0code&state=%x-%s", stateHash, clockTime.UTC().Format("060102150405"))
	request := httptest.NewRequest(http.MethodGet, uri, nil)
	request.AddCookie(&http.Cookie{
		Name:  OpenIdNonceCookieName,
		Value: "nonceString",
	})

	controller := NewOpenIdAuthController(CookieSessionPersistor{}, func(authInfo *api.AuthInfo) (*business.Layer, error) {
		assert.Fail(t, "Business layer should not be instantiated")
		return nil, nil
	})

	rr := httptest.NewRecorder()
	controller.GetAuthCallbackHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Failf(t, "Callback function shouldn't have been called.", "")
	})).ServeHTTP(rr, request)

	// nonce cookie cleanup
	response := rr.Result()
	assert.Len(t, response.Cookies(), 1)
	assert.Equal(t, OpenIdNonceCookieName, response.Cookies()[0].Name)
	assert.True(t, clockTime.After(response.Cookies()[0].Expires))

	// Redirection to boot the UI
	q := url.Values{}
	q.Add("openid_error", "OpenId token rejected: nonce code mismatch")
	assert.Equal(t, "/kiali-test/?"+q.Encode(), response.Header.Get("Location"))
	assert.Equal(t, http.StatusFound, response.StatusCode)
}
