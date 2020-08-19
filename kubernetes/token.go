package kubernetes

import "io/ioutil"

// Be careful with how you use this token. This is the Kiali Service Account token, not the user token.
// We need the Service Account token to access third-party in-cluster services (e.g. Grafana).

const DefaultServiceAccountPath = "/var/run/secrets/kubernetes.io/serviceaccount/token"

var KialiToken string

func GetKialiToken() (string, error) {
	if KialiToken == "" {
		if remoteSecret, err := GetRemoteSecret(RemoteSecretData); err == nil {
			KialiToken = remoteSecret.Users[0].User.Token
		} else {
			token, err := ioutil.ReadFile(DefaultServiceAccountPath)
			if err != nil {
				return "", err
			}
			KialiToken = string(token)
		}
	}
	return KialiToken, nil
}
