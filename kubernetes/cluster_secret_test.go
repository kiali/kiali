package kubernetes

import (
	"os"
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

	rcis, _, err := GetRemoteClusterInfos()
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

// TestDuplicateClusterSecretsKeepInventoriesDisjoint pins the loader's name reservation: two
// mounted secrets naming the same remote must leave the active and skipped inventories
// disjoint whichever secret sorts first - a broken definition cannot be overridden into a
// half-active state, and a valid one cannot be shadowed into the skip registry.
func TestDuplicateClusterSecretsKeepInventoriesDisjoint(t *testing.T) {
	for _, tc := range []struct {
		name          string
		first, second string
	}{
		{"broken sorts first", "aaa-broken", "zzz-valid"},
		{"valid sorts first", "aaa-valid", "zzz-broken"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			check := assert.New(t)
			conf := config.NewConfig()
			conf.KubernetesConfig.ClusterName = config.DefaultClusterID
			config.Set(conf)

			// One secrets root, two secret directories, both naming the same cluster.
			originalDir := RemoteClusterSecretsDir
			root := t.TempDir()
			RemoteClusterSecretsDir = root
			t.Cleanup(func() { RemoteClusterSecretsDir = originalDir })

			const clusterName = "TestDuplicateCluster"
			broken := "this is not a kubeconfig"
			valid := remoteClusterYAML
			if tc.first == "zzz-valid" {
				broken, valid = valid, broken
			}
			// Each secret directory carries a file named after the shared cluster name,
			// as a real kiali-multi-cluster-secret does.
			for secret, content := range map[string]string{tc.first: broken, tc.second: valid} {
				dir := root + "/" + secret
				if err := os.MkdirAll(dir, 0o777); err != nil {
					t.Fatalf("failed to create secret dir: %v", err)
				}
				if err := os.WriteFile(dir+"/"+clusterName, []byte(content), 0o666); err != nil {
					t.Fatalf("failed to write secret file: %v", err)
				}
			}

			_, unprocessable, err := GetRemoteClusterInfos()
			check.NoError(err)

			// Whichever file the loader met first owns the name: the outcome is one of
			// "active" or "unprocessable", never both, never neither.
			infos, _, err := GetRemoteClusterInfos()
			check.NoError(err)
			_, active := infos[clusterName]
			skipped := false
			for _, name := range unprocessable {
				if name == clusterName {
					skipped = true
				}
			}
			check.True(active != skipped, "cluster must be exactly one of active or unprocessable (active=%v, unprocessable=%v)", active, skipped)
		})
	}
}
