package kubernetes

import (
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

const tmpFileTokenExpired = "/tmp/token"
const tmpFileGetToken = "/tmp/token2"

// Test Token is Expired
func TestIsTokenExpired(t *testing.T) {

	SetDefaultServiceAccountPath(tmpFileTokenExpired)
	SetTokenExpireDuration(5 * time.Second)

	setupFile("thisisarandomtoken", tmpFileTokenExpired)
	token, err := GetKialiToken()

	assert.True(t, err == nil)
	assert.True(t, token != "")
	assert.False(t, IsTokenExpired())

	removeFile(tmpFileTokenExpired)
}

// Test Kiali Get Token
func TestGetKialiToken(t *testing.T) {
	SetDefaultServiceAccountPath(tmpFileGetToken)
	data := "thisisarandomtoken"
	setupFile(data, tmpFileGetToken)
	token, err := GetKialiToken()
	if err != nil {
		fmt.Println("Error getting token")
	}
	assert.True(t, data == token)
	removeFile(tmpFileGetToken)
}

// Aux func to setup files
func setupFile(content string, name string) {
	data := []byte(content)
	err := os.WriteFile(name, data, 0644)
	if err != nil {
		fmt.Println("Error writting file")
	}
}

// Aux func to remove file
func removeFile(name string) {
	err := os.Remove(name)
	if err != nil {
		fmt.Println("Error writting file")
	}
}
