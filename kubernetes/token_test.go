package kubernetes

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/config"
)

const (
	tmpFileTokenExpired = "/tmp/token"
	tmpFileGetToken     = "/tmp/token2"
)

// Test Token is Expired
func TestIsTokenExpired(t *testing.T) {
	require := require.New(t)
	assert := assert.New(t)
	config := config.NewConfig()
	SetConfig(t, *config)

	DefaultServiceAccountPath = tmpFileTokenExpired

	setupFile(t, "thisisarandomtoken", tmpFileTokenExpired)
	token, _, err := GetKialiTokenForHomeCluster()
	require.NoError(err)

	assert.True(token != "")
	assert.False(shouldRefreshToken())
}

// Test Kiali Get Token
func TestGetKialiToken(t *testing.T) {
	require := require.New(t)
	assert := assert.New(t)
	config := config.NewConfig()
	SetConfig(t, *config)

	DefaultServiceAccountPath = tmpFileGetToken
	data := "thisisarandomtoken"

	setupFile(t, data, tmpFileGetToken)

	token, _, err := GetKialiTokenForHomeCluster()
	require.NoError(err)

	assert.Equal(data, token)
}

// Aux func to setup files
func setupFile(t *testing.T, content string, name string) {
	data := []byte(content)
	if err := os.WriteFile(name, data, 0o644); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := os.Remove(name); err != nil {
			t.Fatal(err)
		}
	})
}
