package kubernetes

import "io/ioutil"

// Be careful with how you use this token. This is the Kiali Service Account token, not the user token.
// We need the Service Account token to access third-party in-cluster services (e.g. Grafana).

var KialiToken string

func GetKialiToken() (string, error) {
	if KialiToken == "" {
		token, err := ioutil.ReadFile("/var/run/secrets/kubernetes.io/serviceaccount/token")
		if err != nil {
			return "", err
		}
		KialiToken = string(token)
	}
	return KialiToken, nil
}
