package kubernetes

import (
	"os"
	"testing"
	"time"

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
	config.Deployment.RemoteSecretPath = t.TempDir()
	SetConfig(t, *config)

	DefaultServiceAccountPath = tmpFileTokenExpired

	setupFile(t, "thisisarandomtoken", tmpFileTokenExpired)
	token, err := GetKialiTokenForHomeCluster()
	require.NoError(err)

	assert.True(token != "")
	assert.False(shouldRefreshToken())
}

// Test Kiali Get Token
func TestGetKialiToken(t *testing.T) {
	require := require.New(t)
	assert := assert.New(t)
	config := config.NewConfig()
	config.Deployment.RemoteSecretPath = t.TempDir()
	SetConfig(t, *config)

	DefaultServiceAccountPath = tmpFileGetToken
	data := "thisisarandomtoken"

	setupFile(t, data, tmpFileGetToken)

	token, err := GetKialiTokenForHomeCluster()
	require.NoError(err)

	assert.Equal(data, token)
}

func TestGetKialiTokenRemoteCluster(t *testing.T) {
	require := require.New(t)

	config := config.NewConfig()
	config.Deployment.RemoteSecretPath = "testdata/remote-cluster-multiple-users.yaml"
	SetConfig(t, *config)
	tokenRead = time.Time{}

	token, err := GetKialiTokenForHomeCluster()
	require.NoError(err)

	require.Equal("token2", token)
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
