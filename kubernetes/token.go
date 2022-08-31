package kubernetes

import (
	"io/ioutil"
	"time"

	kialiConfig "github.com/kiali/kiali/config"
)

// Be careful with how you use this token. This is the Kiali Service Account token, not the user token.
// We need the Service Account token to access third-party in-cluster services (e.g. Grafana).

var DefaultServiceAccountPath = "/var/run/secrets/kubernetes.io/serviceaccount/token"

var KialiToken string
var tokenRead time.Time
var tokenExpireDuration time.Duration

func GetKialiToken() (string, error) {
	if KialiToken == "" || IsTokenExpired() {
		if remoteSecret, err := GetRemoteSecret(RemoteSecretData); err == nil {
			KialiToken = remoteSecret.Users[0].User.Token
		} else {
			token, err := ioutil.ReadFile(DefaultServiceAccountPath)
			if err != nil {
				return "", err
			}
			KialiToken = string(token)
		}
		tokenRead = time.Now()
	}
	return KialiToken, nil
}

// Check if token expired based on the k configuration
func IsTokenExpired() bool {

	if tokenExpireDuration == 0 {
		kConfig := kialiConfig.Get()
		tokenExpireDuration = time.Duration(kConfig.KubernetesConfig.TokenExpireDuration) * time.Second
	}

	if time.Since(tokenRead) > tokenExpireDuration {
		return true
	} else {
		return false
	}
}
