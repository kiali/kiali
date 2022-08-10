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
var LastRead, timer time.Time
var isRemote bool

func getDefaultServiceAccountPath() string {
	return DefaultServiceAccountPath
}

func GetKialiToken() (string, error) {
	expired, err := IsTokenExpired()
	if KialiToken == "" || (expired && err == nil) {
		if remoteSecret, err := GetRemoteSecret(RemoteSecretData); err == nil {
			KialiToken = remoteSecret.Users[0].User.Token
			LastRead = time.Now()
			isRemote = true
		} else {
			errUpdating := updateKialiToken()
			isRemote = false
			if errUpdating != nil {
				fmt.Errorf("Error updating Kiali token: " + errUpdating.Error())
			}
		}
	}
	return KialiToken, nil
}

// Set Kiali Service Account Token
func updateKialiToken() error {
	token, errRead := ioutil.ReadFile(getDefaultServiceAccountPath())
	if errRead != nil {
		fmt.Println(errRead)
	}
	KialiToken = string(token)
	LastRead = time.Now()
	return nil
}

// Return time for when a file was last modified
func getLastModified(fileName string) (time.Time, error) {

	file, err := os.Stat(fileName)
	if err != nil {
		return time.Time{}, err
	}
	return file.ModTime(), nil
}

// token is expired if the token file has been modified
// Just checking once every minute
func IsTokenExpired() (bool, error) {

	if time.Now().Unix()-timer.Unix() > 60 {
		path := getDefaultServiceAccountPath()
		if isRemote {
			path = RemoteSecretData
		}
		checkModifiedTime, err := getLastModified(path)
		timer = time.Now()
		if err != nil {
			return false, err
		}
		if checkModifiedTime.Unix() > LastRead.Unix() {
			return true, nil
		}
	}
	return false, nil
}
