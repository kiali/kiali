package kubernetes

import (
	"fmt"
	"github.com/stretchr/testify/assert"
	"os"
	"testing"
	"time"
)

const tmpFile = "/tmp/token"

// Test Token is Expired
func TestIsTokenExpired(t *testing.T) {

	SetDefaultServiceAccountPath(tmpFile)
	SetTokenExpireDuration(5 * time.Second)

	setupFile("thisisarandomtoken")
	token, err := GetKialiToken()

	assert.True(t, err == nil)
	assert.True(t, token != "")
	assert.False(t, IsTokenExpired())

	SetTokenExpireDuration(0)
	token, err = GetKialiToken()

	assert.True(t, err == nil)
	assert.True(t, token != "")
	assert.True(t, IsTokenExpired())
}

// Test Kiali Get Token
func TestGetKialiToken(t *testing.T) {
	data := "thisisarandomtoken"
	setupFile(data)
	token, err := GetKialiToken()
	if err != nil {
		fmt.Println("Error getting token")
	}
	assert.True(t, data == token)
	removeFile()
}

// Aux func to setup files
func setupFile(content string) {
	data := []byte(content)
	err := os.WriteFile(tmpFile, data, 0644)
	if err != nil {
		fmt.Println("Error writting file")
	}
}

// Aux func to remove file
func removeFile() {
	err := os.Remove(tmpFile)
	if err != nil {
		fmt.Println("Error writting file")
	}
}
