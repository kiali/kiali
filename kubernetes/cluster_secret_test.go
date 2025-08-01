package kubernetes

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"k8s.io/client-go/rest"

	"github.com/kiali/kiali/config"
)

func TestReloadRemoteClusterSecret(t *testing.T) {
	check := assert.New(t)
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	config.Set(conf)

	const testClusterName = "TestRemoteCluster"

	createTestRemoteClusterSecret(t, testClusterName, remoteClusterYAML)

	const testTokenFile = "/my/token/file"
	clientFactory, err := NewClientFactory(t.Context(), conf, &rest.Config{BearerToken: "home-cluster-token", BearerTokenFile: testTokenFile})
	check.NoError(err)

	var clusterNames []string
	for cluster := range clientFactory.GetSAClients() {
		clusterNames = append(clusterNames, cluster)
	}
	check.Equal(2, len(clusterNames), "Should have seen the remote cluster secret")
	check.Contains(clusterNames, conf.KubernetesConfig.ClusterName)
	check.Contains(clusterNames, testClusterName)

	rcis, err := GetRemoteClusterInfos()
	check.NoError(err)
	rciConfig := rcis[testClusterName].ClientConfig
	check.NotNil(rciConfig)

	// test the home cluster config
	restConfig := clientFactory.GetSAClient(conf.KubernetesConfig.ClusterName).ClusterInfo().ClientConfig
	check.Equal(testTokenFile, restConfig.BearerTokenFile, "BearerTokenFile should always be set to the home cluster SA token file")
	check.NotEmpty(restConfig.BearerToken, "BearerToken should be set for home cluster")

	// test the remote cluster config
	restConfig = clientFactory.GetSAClient(testClusterName).ClusterInfo().ClientConfig
	check.Equal("", restConfig.BearerTokenFile, "BearerTokenFile is never set")
	check.Equal(rciConfig.BearerToken, restConfig.BearerToken, "BearerToken should be set to the value in the remote cluster yaml")
}
