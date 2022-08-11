package kubernetes

import (
	"fmt"
	"github.com/stretchr/testify/assert"
	"os"
	"testing"
	"time"
)

const tempFile = "/tmp/token"

func TestIsTokenExpired(t *testing.T) {

	setDefaultServiceAccountPath(tempFile)
	GetKialiToken()

	setupFile("thisisarandomtoken")

	test, err := IsTokenExpired()
	if err != nil {
		fmt.Println("Error getting token")
	}
	assert.False(t, test)

	setRefreshTime(int64(2))
	time.Sleep(3000000000)
	setupFile("thisisarandomModifiedtoken")

	test2, err := IsTokenExpired()
	assert.True(t, test2)

	time.Sleep(5000000000) // It looks like update stats of the file takes a while
	GetKialiToken()
	time.Sleep(6000000000)

	test3, err := IsTokenExpired()
	assert.False(t, test3)
}

func TestGetLastModified(t *testing.T) {

	setDefaultServiceAccountPath(tempFile)
	GetKialiToken()

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
