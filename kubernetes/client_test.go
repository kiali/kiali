package kubernetes

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/util/filetest"
)

func TestNewClientsFromKubeConfig(t *testing.T) {
	tests := map[string]struct {
		kubeConfigContents    string
		remoteClusterContexts []string
		homeClusterContext    string
		clusterNameOverrides  map[string]string
		expectedClientCount   int
		expectedClusterNames  []string
		wantErr               bool
	}{
		"single cluster with current context": {
			kubeConfigContents: `
apiVersion: v1
kind: Config
current-context: cluster1
contexts:
- name: cluster1
  context:
    cluster: cluster1
    user: user1
clusters:
- name: cluster1
  cluster:
    server: https://cluster1.example.com
    insecure-skip-tls-verify: true
users:
- name: user1
  user:
    token: fake-token1
`,
			expectedClientCount:  1,
			expectedClusterNames: []string{"cluster1"},
			wantErr:              false,
		},
		"multiple clusters with remote contexts": {
			kubeConfigContents: `
apiVersion: v1
kind: Config
current-context: cluster1
contexts:
- name: cluster1
  context:
    cluster: cluster1
    user: user1
- name: cluster2
  context:
    cluster: cluster2
    user: user2
- name: cluster3
  context:
    cluster: cluster3
    user: user3
clusters:
- name: cluster1
  cluster:
    server: https://cluster1.example.com
    insecure-skip-tls-verify: true
- name: cluster2
  cluster:
    server: https://cluster2.example.com
    insecure-skip-tls-verify: true
- name: cluster3
  cluster:
    server: https://cluster3.example.com
    insecure-skip-tls-verify: true
users:
- name: user1
  user:
    token: fake-token1
- name: user2
  user:
    token: fake-token2
- name: user3
  user:
    token: fake-token3
`,
			remoteClusterContexts: []string{"cluster2", "cluster3"},
			expectedClientCount:   3,
			expectedClusterNames:  []string{"cluster1", "cluster2", "cluster3"},
			wantErr:               false,
		},
		"specified home cluster context": {
			kubeConfigContents: `
apiVersion: v1
kind: Config
current-context: cluster1
contexts:
- name: cluster1
  context:
    cluster: cluster1
    user: user1
- name: cluster2
  context:
    cluster: cluster2
    user: user2
clusters:
- name: cluster1
  cluster:
    server: https://cluster1.example.com
    insecure-skip-tls-verify: true
- name: cluster2
  cluster:
    server: https://cluster2.example.com
    insecure-skip-tls-verify: true
users:
- name: user1
  user:
    token: fake-token1
- name: user2
  user:
    token: fake-token2
`,
			homeClusterContext:   "cluster2",
			expectedClientCount:  1,
			expectedClusterNames: []string{"cluster2"},
			wantErr:              false,
		},
		"with cluster name overrides": {
			kubeConfigContents: `
apiVersion: v1
kind: Config
current-context: cluster1
contexts:
- name: cluster1
  context:
    cluster: cluster1
    user: user1
- name: cluster2
  context:
    cluster: cluster2
    user: user2
clusters:
- name: cluster1
  cluster:
    server: https://cluster1.example.com
    insecure-skip-tls-verify: true
- name: cluster2
  cluster:
    server: https://cluster2.example.com
    insecure-skip-tls-verify: true
users:
- name: user1
  user:
    token: fake-token1
- name: user2
  user:
    token: fake-token2
`,
			remoteClusterContexts: []string{"cluster2"},
			clusterNameOverrides:  map[string]string{"cluster1": "home-cluster", "cluster2": "remote-cluster"},
			expectedClientCount:   2,
			expectedClusterNames:  []string{"home-cluster", "remote-cluster"},
			wantErr:               false,
		},
		"invalid kubeconfig - missing contexts": {
			kubeConfigContents: `
apiVersion: v1
kind: Config
current-context: cluster1
clusters:
- name: cluster1
  cluster:
    server: https://cluster1.example.com
    insecure-skip-tls-verify: true
users:
- name: user1
  user:
    token: fake-token1
`,
			wantErr: true,
		},
		"invalid kubeconfig - missing clusters": {
			kubeConfigContents: `
apiVersion: v1
kind: Config
current-context: cluster1
contexts:
- name: cluster1
  context:
    cluster: cluster1
    user: user1
users:
- name: user1
  user:
    token: fake-token1
`,
			wantErr: true,
		},
		"empty kubeconfig": {
			kubeConfigContents: "",
			wantErr:            true,
		},
		"non-existent context specified": {
			kubeConfigContents: `
apiVersion: v1
kind: Config
current-context: cluster1
contexts:
- name: cluster1
  context:
    cluster: cluster1
    user: user1
clusters:
- name: cluster1
  cluster:
    server: https://cluster1.example.com
    insecure-skip-tls-verify: true
users:
- name: user1
  user:
    token: fake-token1
`,
			homeClusterContext: "non-existent",
			wantErr:            true,
		},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			assert := assert.New(t)
			require := require.New(t)

			var kubeConfigBytes []byte
			if tc.kubeConfigContents != "" {
				kubeConfigBytes = []byte(tc.kubeConfigContents)
			}
			tempFile := filetest.TempFile(t, kubeConfigBytes)

			conf := config.NewConfig()
			if tc.clusterNameOverrides != nil {
				conf.Deployment.ClusterNameOverrides = tc.clusterNameOverrides
			}

			clients, err := NewClientsFromKubeConfig(conf, tempFile.Name(), tc.remoteClusterContexts, tc.homeClusterContext)
			if tc.wantErr {
				require.Error(err)
				return
			}

			require.NoError(err)
			require.NotNil(clients)
			assert.Equal(tc.expectedClientCount, len(clients))

			if tc.expectedClusterNames != nil {
				actualClusterNames := make([]string, 0, len(clients))
				for clusterName := range clients {
					actualClusterNames = append(actualClusterNames, clusterName)
				}
				assert.ElementsMatch(tc.expectedClusterNames, actualClusterNames)
			}

			for clusterName, client := range clients {
				assert.NotNil(client)
				assert.Equal(clusterName, client.ClusterInfo().Name)
				assert.NotNil(client.ClusterInfo().ClientConfig)
			}
		})
	}
}
