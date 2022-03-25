package util

import (
	"os"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util/httputil"
)

var kialiURL string
var kialiToken string

func init() {
	kialiURL = os.Getenv("URL")
	kialiToken = os.Getenv("TOKEN")
	if kialiURL == "" || kialiToken == "" {
		log.Fatalf("URL and TOKEN env variables are required")
	}
}

func KialiStatus() (bool, error) {
	_, _, err := httputil.HttpGet(kialiURL+"/api/istio/status", GetAuth(), 10*time.Second, nil)
	if err == nil {
		return true, nil
	} else {
		return false, err
	}
}

func GetAuth() *config.Auth {
	return &config.Auth{
		Token:              kialiToken,
		UseKialiToken:      true,
		InsecureSkipVerify: true,
	}
}
