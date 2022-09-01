package kubernetes

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

const tmpFileTokenExpired = "/tmp/token"
const tmpFileGetToken = "/tmp/token2"

// Test Token is Expired
func TestIsTokenExpired(t *testing.T) {

	DefaultServiceAccountPath = tmpFileTokenExpired

	setupFile("thisisarandomtoken", tmpFileTokenExpired, t)
	token, err := GetKialiToken()
	assert.Nil(t, err)

	assert.True(t, token != "")
	assert.False(t, shouldRefreshToken())

	removeFile(tmpFileTokenExpired, t)
}

// Test Kiali Get Token
func TestGetKialiToken(t *testing.T) {
	DefaultServiceAccountPath = tmpFileGetToken
	data := "thisisarandomtoken"

	setupFile(data, tmpFileGetToken, t)

	token, err := GetKialiToken()
	assert.Nil(t, err)

	assert.True(t, data == token)
	removeFile(tmpFileGetToken, t)
}

// Aux func to setup files
func setupFile(content string, name string, t *testing.T) {
	data := []byte(content)
	err := os.WriteFile(name, data, 0644)
	assert.Nil(t, err)
}

// Aux func to remove file
func removeFile(name string, t *testing.T) {
	err := os.Remove(name)
	assert.Nil(t, err)
}
