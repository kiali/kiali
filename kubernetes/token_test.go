package kubernetes

import (
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

const tempFile = "/tmp/token"

func TestIsTokenExpired(t *testing.T) {

	setDefaultServiceAccountPath(tempFile)
	token, err := GetKialiToken()
	assert.True(t, err != nil)
	assert.True(t, token != "")

	setupFile("thisisarandomtoken")

	test, err := IsTokenExpired()
	assert.True(t, err != nil)
	assert.False(t, test)

	setRefreshTime(int64(2))
	time.Sleep(3000000000)
	setupFile("thisisarandomModifiedtoken")

	test2, err2 := IsTokenExpired()
	assert.True(t, err2 != nil)
	assert.True(t, test2)

	time.Sleep(5000000000) // It looks like update stats of the file takes a while
	token2, errGetToken := GetKialiToken()
	assert.True(t, errGetToken == nil)
	assert.True(t, token2 != "")

	time.Sleep(6000000000)

	test3, err3 := IsTokenExpired()
	assert.True(t, err3 != nil)
	assert.False(t, test3)
}

func TestGetLastModified(t *testing.T) {

	setDefaultServiceAccountPath(tempFile)
	token, err := GetKialiToken()
	if err != nil {
		fmt.Println("Error getting token")
	} else {
		assert.True(t, token != "")
	}

	setupFile("thisisarandomtoken")

	lastModified, err := getLastModified(tempFile)
	if err != nil {
		fmt.Println("Error getting token")
	}

	time.Sleep(3000000000) // Take some time to let the file stats get updated
	assert.True(t, lastModified.Unix() < time.Now().Unix())

}

func TestGetKialiToken(t *testing.T) {
	data := "thisisarandomtoken"
	setupFile(data)
	token, err := GetKialiToken()
	if err == nil {
		fmt.Println("Error getting token")
	}
	assert.True(t, data == token)

}

func setupFile(content string) {
	data := []byte(content)
	err := os.WriteFile(tempFile, data, 0644)
	if err != nil {
		fmt.Println("Error writting file")
	}
}
