package kubernetes

import (
	"fmt"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"gopkg.in/yaml.v2"
	"k8s.io/client-go/rest"

	"github.com/kiali/kiali/config"
)

func TestReloadRemoteClusterSecret(t *testing.T) {
	// create a mock volume mount directory where the test remote cluster secret content will go
	originalRemoteClusterSecretsDir := RemoteClusterSecretsDir
	defer func(dir string) {
		RemoteClusterSecretsDir = dir
	}(originalRemoteClusterSecretsDir)
	RemoteClusterSecretsDir = t.TempDir()

	// need to turn off in-cluster so the factory doesn't look for the home cluster SA token on the file system
	conf := config.NewConfig()
	conf.InCluster = false
	config.Set(conf)
	t.Setenv("KUBERNETES_SERVICE_HOST", "127.0.0.2")
	t.Setenv("KUBERNETES_SERVICE_PORT", "9443")
	t.Setenv("ACTIVE_NAMESPACE", "foo")

	check := assert.New(t)

	testClusterName := "TestRemoteCluster"
	remoteSecretData := RemoteSecret{
		Clusters: []RemoteSecretClusterListItem{
			{
				Name: testClusterName,
				Cluster: RemoteSecretCluster{
					Server: "https://192.168.1.2:1234",
				},
			},
		},
		Users: []RemoteSecretUser{
			{
				Name: "remoteuser1",
				User: RemoteSecretUserToken{
					Token: "remotetoken1",
				},
			},
		},
	}
	marshalledRemoteSecretData, _ := yaml.Marshal(remoteSecretData)
	createTestRemoteClusterSecretFile(t, RemoteClusterSecretsDir, remoteSecretData.Clusters[0].Name, string(marshalledRemoteSecretData))

	restConfig := rest.Config{}
	clientFactory, err := newClientFactory(&restConfig)
	check.Nil(err)
	check.NotNil(clientFactory)

	var clusterNames []string
	for cluster := range clientFactory.saClientEntries {
		clusterNames = append(clusterNames, cluster)
	}
	check.Equal(2, len(clusterNames), "Should have seen the remote cluster secret")
	check.Contains(clusterNames, HomeClusterName)
	check.Contains(clusterNames, testClusterName)

	testRCI := clientFactory.remoteClusterInfos[testClusterName]
	reloadedObj, err := reloadRemoteClusterInfoFromFile(testRCI)
	check.Nil(err)
	check.Nil(reloadedObj, "Nothing changed with the secret - the reload func should have returned nil")

	// change the token and ensure the reload method knows it changed - this is the trigger that will cause clients to be refreshed
	remoteSecretData.Users[0].User.Token = "CHANGED TOKEN"
	marshalledRemoteSecretData, _ = yaml.Marshal(remoteSecretData)
	createTestRemoteClusterSecretFile(t, RemoteClusterSecretsDir, remoteSecretData.Clusters[0].Name, string(marshalledRemoteSecretData))
	reloadedObj, err = reloadRemoteClusterInfoFromFile(testRCI)
	check.Nil(err)
	check.NotNil(reloadedObj, "The token changed - the reload func should have returned a new object")
	check.Equal(reloadedObj.User.User.Token, "CHANGED TOKEN")
}

func createTestRemoteClusterSecretFile(t *testing.T, parentDir string, name string, content string) {
	childDir := fmt.Sprintf("%s/%s", parentDir, name)
	filename := fmt.Sprintf("%s/%s", childDir, name)
	if err := os.MkdirAll(childDir, 0o777); err != nil {
		t.Fatalf("Failed to create tmp remote cluster secret dir [%v]: %v", childDir, err)
	}
	f, err := os.Create(filename)
	if err != nil {
		t.Fatalf("Failed to create tmp remote cluster secret file [%v]: %v", filename, err)
	}
	defer f.Close()
	if _, err2 := f.WriteString(content); err2 != nil {
		t.Fatalf("Failed to write tmp remote cluster secret file [%v]: %v", filename, err2)
	}
}
