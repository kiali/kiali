package kubernetes

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
)

func TestReloadRemoteClusterSecret(t *testing.T) {
	check := assert.New(t)
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	config.Set(conf)

	const testClusterName = "TestRemoteCluster"

	createTestRemoteClusterSecret(t, testClusterName, remoteClusterYAML)

	clientFactory := NewTestingClientFactory(t)

	var clusterNames []string
	for cluster := range clientFactory.saClientEntries {
		clusterNames = append(clusterNames, cluster)
	}
	check.Equal(2, len(clusterNames), "Should have seen the remote cluster secret")
	check.Contains(clusterNames, conf.KubernetesConfig.ClusterName)
	check.Contains(clusterNames, testClusterName)

	rcis, err := GetRemoteClusterInfos()
	check.Nil(err)

	// test the home cluster config
	restConfig := clientFactory.GetSAClient(conf.KubernetesConfig.ClusterName).ClusterInfo().ClientConfig
	check.Equal(KialiTokenFileForHomeCluster, restConfig.BearerTokenFile, "BearerTokenFile should always be set to the home cluster SA token file")
	check.Equal(KialiTokenForHomeCluster, restConfig.BearerToken, "BearerToken should be set for home cluster")

	// test the remote cluster config
	testRCI := rcis[testClusterName]
	restConfig, err = clientFactory.getConfig(&testRCI)
	check.Nil(err)
	check.Equal("", restConfig.BearerTokenFile, "BearerTokenFile is never set")
	check.Equal("token", restConfig.BearerToken, "BearerToken should be set to the value in the remote cluster yaml")
}
