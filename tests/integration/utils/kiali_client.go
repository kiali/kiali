package utils

import (
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util/httputil"
)

var kialiURL string
var kialiToken string
var kialiCookies []*http.Cookie

func init() {
	kialiURL = os.Getenv("URL")
	kialiToken = os.Getenv("TOKEN")
	if kialiURL == "" || kialiToken == "" {
		log.Fatalf("URL and TOKEN environment variables are required. Kiali URL in 'https://kiali-hostname' and TOKEN in 'sha256~' format.")
		return
	}
	tokenResult, tokenCookies := GetCookies()
	if !tokenResult || tokenCookies == nil {
		log.Fatalf("Unable to login to the Kiali: %s by provided token: %s", kialiURL, kialiToken)
		return
	}
	kialiCookies = tokenCookies
}

func KialiStatus() (bool, int, error) {
	_, code, err := httputil.HttpGet(kialiURL+"/api/istio/status", GetAuth(), 10*time.Second, nil, kialiCookies)
	if err == nil {
		return true, code, nil
	} else {
		return false, code, err
	}
}

func GetAuth() *config.Auth {
	return &config.Auth{
		Token:              kialiToken,
		Type:               config.AuthTypeBearer,
		InsecureSkipVerify: true,
	}
}

func GetCookies() (bool, []*http.Cookie) {
	auth := GetAuth()
	requestParams := url.Values{}
	requestParams.Set("access_token", auth.Token)
	requestParams.Set("expires_in", "86400")
	customHeaders := map[string]string{
		"Content-Type": "application/x-www-form-urlencoded",
	}
	_, code, cookies, err := httputil.HttpPost(kialiURL+"/api/authenticate", auth, strings.NewReader(requestParams.Encode()), 10*time.Second, customHeaders)
	if code == 200 && err == nil && cookies != nil {
		return true, cookies
	}
	return false, nil
}
