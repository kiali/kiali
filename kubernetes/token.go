package kubernetes

import (
	"os"
	"time"
)

// Be careful with how you use this token. This is the Kiali Service Account token, not the user token.
// We need the Service Account token to access third-party in-cluster services (e.g. Grafana).

var DefaultServiceAccountPath = "/var/run/secrets/kubernetes.io/serviceaccount/token"

var (
	KialiTokenForHomeCluster string
	tokenRead                time.Time
)

// GetKialiTokenForHomeCluster returns the Kiali SA token to be used to communicate with the local data plane k8s api endpoint.
func GetKialiTokenForHomeCluster() (string, error) {
	// TODO: refresh the token when it changes rather than after it expires
	if KialiTokenForHomeCluster == "" || shouldRefreshToken() {
		if remoteSecret, err := GetRemoteSecret(RemoteSecretData); err == nil { // for experimental feature - for when data plane is in a remote cluster
			for _, authInfo := range remoteSecret.AuthInfos {
				// Remote secrets with only a single auth info are supported.
				KialiTokenForHomeCluster = authInfo.Token
				break
			}
		} else {
			token, err := os.ReadFile(DefaultServiceAccountPath)
			if err != nil {
				return "", err
			}
			KialiTokenForHomeCluster = string(token)
		}
		tokenRead = time.Now()
	}
	return KialiTokenForHomeCluster, nil
}

// shouldRefreshToken checks to see if the local Kiali token expired.
// TODO should check all tokens for all clusters
func shouldRefreshToken() bool {
	// TODO: hardcoded to 60s, do we want this configurable? Or do we need to obtain this from k8s somehow?
	timerDuration := time.Second * 60

	if time.Since(tokenRead) > timerDuration {
		return true
	} else {
		return false
	}
}
