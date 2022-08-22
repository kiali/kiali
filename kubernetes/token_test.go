package kubernetes

import (
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

	errCr := setupFile("thisisarandomtoken", tmpFileTokenExpired)
	assert.Nil(t, errCr)
	token, err := GetKialiToken()
	assert.Nil(t, err)

	assert.True(t, token != "")
	assert.False(t, IsTokenExpired())

	errRm := removeFile(tmpFileTokenExpired)
	assert.Nil(t, errRm)
}

// Test Kiali Get Token
func TestGetKialiToken(t *testing.T) {
	SetDefaultServiceAccountPath(tmpFileGetToken)
	data := "thisisarandomtoken"

	errCr := setupFile(data, tmpFileGetToken)
	assert.Nil(t, errCr)

	token, err := GetKialiToken()
	assert.Nil(t, err)

	assert.True(t, data == token)
	errRm := removeFile(tmpFileGetToken)
	assert.Nil(t, errRm)
}

// Aux func to setup files
func setupFile(content string, name string) error {
	data := []byte(content)
	err := os.WriteFile(name, data, 0644)
	return err
}

// Aux func to remove file
func removeFile(name string) error {
	err := os.Remove(name)
	return err
}
