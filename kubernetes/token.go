package kubernetes

import (
	"os"
	"time"
)

// Be careful with how you use this token. This is the Kiali Service Account token, not the user token.
// We need the Service Account token to access third-party in-cluster services (e.g. Grafana).

var DefaultServiceAccountPath = "/var/run/secrets/kubernetes.io/serviceaccount/token"

var (
	KialiTokenForHomeCluster     string
	KialiTokenFileForHomeCluster string
	tokenRead                    time.Time
)

// GetKialiTokenForHomeCluster returns the Kiali SA token to be used to communicate with the local data plane k8s api endpoint and the token file.
func GetKialiTokenForHomeCluster() (string, string, error) {
	// TODO: refresh the token when it changes rather than after it expires
	if KialiTokenForHomeCluster == "" || shouldRefreshToken() {
		token, err := os.ReadFile(DefaultServiceAccountPath)
		if err != nil {
			return "", "", err
		}
		KialiTokenForHomeCluster = string(token)
		KialiTokenFileForHomeCluster = DefaultServiceAccountPath
	}
	return KialiTokenForHomeCluster, KialiTokenFileForHomeCluster, nil
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
