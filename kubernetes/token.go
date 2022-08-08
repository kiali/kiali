package kubernetes

import (
	"fmt"
	"io/ioutil"
	"os"
	"time"
)

// Be careful with how you use this token. This is the Kiali Service Account token, not the user token.
// We need the Service Account token to access third-party in-cluster services (e.g. Grafana).

const DefaultServiceAccountPath = "/var/run/secrets/kubernetes.io/serviceaccount/token"

var KialiToken string
var LastRead time.Time

func GetKialiToken() (string, error) {
	expired, err := IsTokenExpired()
	if KialiToken == "" || (expired && err == nil) {
		if remoteSecret, err := GetRemoteSecret(RemoteSecretData); err == nil {
			KialiToken = remoteSecret.Users[0].User.Token
		} else {
			errUpdating := updateKialiToken()
			if errUpdating != nil {
				fmt.Errorf("Error updating Kiali token: " + errUpdating.Error())
			}
		}
	}
	return KialiToken, nil
}

func updateKialiToken() error {
	var err error
	LastRead, err = getLastModified(DefaultServiceAccountPath)
	if err != nil {
		return err
	}
	token, errRead := ioutil.ReadFile(DefaultServiceAccountPath)
	if errRead != nil {
		fmt.Println(errRead)
	}
	KialiToken = string(token)
	return nil
}

// Return time for when a file was last modified
func getLastModified(fileName string) (time.Time, error) {

	file, err := os.Stat(fileName)
	if err != nil {
		fmt.Println(err)
		return time.Time{}, err
	}
	return file.ModTime(), nil
}

// Is token expired is token file has been modified
func IsTokenExpired() (bool, error) {
	checkModifiedTime, err := getLastModified(DefaultServiceAccountPath)
	if err != nil {
		fmt.Println(err)
		return false, err
	}
	if checkModifiedTime.Unix() > LastRead.Unix() {
		return true, nil
	}
	return false, nil
}
