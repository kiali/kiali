package kubernetes

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/client-go/tools/clientcmd"

	"github.com/kiali/kiali/config"
)

func TestReloadRemoteClusterSecret(t *testing.T) {
	check := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()

	const testClusterName = "TestRemoteCluster"

	remoteSecretFilename := createTestRemoteClusterSecret(t, testClusterName, remoteClusterYAML)

	clientFactory := NewTestingClientFactory(t)

	var clusterNames []string
	for cluster := range clientFactory.saClientEntries {
		clusterNames = append(clusterNames, cluster)
	}
	check.Equal(2, len(clusterNames), "Should have seen the remote cluster secret")
	check.Contains(clusterNames, conf.KubernetesConfig.ClusterName)
	check.Contains(clusterNames, testClusterName)

	testRCI := clientFactory.remoteClusterInfos[testClusterName]
	reloadedObj, err := reloadRemoteClusterInfoFromFile(testRCI)
	require.Nil(err)
	require.Nil(reloadedObj, "Nothing changed with the secret - the reload func should have returned nil")

	// change the token and ensure the reload method knows it changed - this is the trigger that will cause clients to be refreshed
	// Load then change the token and then marshal it back to string and then write it back to the file
	kubeConfig, err := clientcmd.Load([]byte(remoteClusterYAML))
	require.NoError(err)

	kubeConfig.AuthInfos["remoteuser1"].Token = "CHANGED TOKEN"
	err = clientcmd.WriteToFile(*kubeConfig, remoteSecretFilename)
	require.NoError(err)

	reloadedObj, err = reloadRemoteClusterInfoFromFile(testRCI)
	require.Nil(err)
	require.NotNil(reloadedObj, "The token changed - the reload func should have returned a new object")

	updatedKubeConfig, err := reloadedObj.Config.RawConfig()
	require.NoError(err)
	check.Equal(updatedKubeConfig.AuthInfos["remoteuser1"].Token, "CHANGED TOKEN")
	check.Equal("CHANGED TOKEN", clientFactory.GetSAClient(testClusterName).GetToken())
}
