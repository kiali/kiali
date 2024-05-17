package tests

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/tests/integration/utils/kiali"
	"github.com/kiali/kiali/tests/integration/utils/kube"
)

func TestRemoteKialiShownInClustersResponse(t *testing.T) {
	require := require.New(t)

	// Get the number of clusters before we start.
	kialiConfig, _, err := kiali.KialiConfig()
	require.NoError(err)
	originalClusters := kialiConfig.Clusters

	ctx := contextWithTestingDeadline(t)
	dynamicClient := kube.NewDynamicClient(t)
	kubeClient := kube.NewKubeClient(t)
	instance, err := kiali.NewInstance(ctx, kubeClient, dynamicClient)
	require.NoError(err)

	// Add an inaccessible cluster/kiali instance to the kiali config and restart kiali.
	conf, err := instance.GetConfig(ctx)
	require.NoError(err)
	originalConf := *conf
	// Set this to something so that the patch isn't omitted for being empty.
	originalConf.Clustering = config.Clustering{
		Clusters:  []config.Cluster{},
		KialiURLs: []config.KialiURL{},
	}

	conf.Clustering.Clusters = []config.Cluster{{Name: "inaccessible"}}
	conf.Clustering.KialiURLs = []config.KialiURL{{ClusterName: "inaccessible", URL: "http://inaccessible:20001", InstanceName: "kiali", Namespace: "istio-system"}}

	t.Cleanup(func() {
		log.Debugf("Updating kiali config to original state")
		require.NoError(instance.UpdateConfig(ctx, &originalConf))
		require.NoError(instance.Restart(ctx))
	})

	require.NoError(instance.UpdateConfig(ctx, conf))
	require.NoError(instance.Restart(ctx))

	kialiConfig, _, err = kiali.KialiConfig()
	require.NoError(err)
	clusters := kialiConfig.Clusters

	// Ensure the inaccessible cluster/kiali instance is shown in the clusters response.
	require.Greater(len(clusters), len(originalClusters))

	inaccessible := clusters["inaccessible"]
	require.NotNil(inaccessible, "inaccessible cluster not found in clusters response")
}
