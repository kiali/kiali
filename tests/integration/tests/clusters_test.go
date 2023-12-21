package tests

import (
	"testing"

	"github.com/stretchr/testify/require"
	"golang.org/x/exp/slices"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/tests/integration/utils/kiali"
	"github.com/kiali/kiali/tests/integration/utils/kube"
)

func TestRemoteKialiShownInClustersResponse(t *testing.T) {
	require := require.New(t)

	// Get the number of clusters before we start.
	originalClusters, err := kiali.Clusters()
	require.NoError(err)

	ctx := contextWithTestingDeadline(t)
	dynamicClient := kube.NewDynamicClient(t)
	kubeClient := kube.NewKubeClient(t)
	instance, err := kiali.NewInstance(ctx, kubeClient, dynamicClient)
	require.NoError(err)

	// Add an inaccessible cluster/kiali instance to the kiali config and restart kiali.
	conf, err := instance.GetConfig(ctx)
	require.NoError(err)
	originalConf := *conf

	conf.Clustering.Clusters = []config.Cluster{{Name: "inaccessible", Accessible: false}}
	conf.Clustering.KialiURLs = []config.KialiURL{{ClusterName: "inaccessible", URL: "http://inaccessible:20001", InstanceName: "kiali", Namespace: "istio-system"}}

	t.Cleanup(func() {
		log.Debugf("Updating kiali config to original state")
		require.NoError(instance.UpdateConfig(ctx, &originalConf))
		require.NoError(instance.Restart(ctx))
	})

	require.NoError(instance.UpdateConfig(ctx, conf))
	require.NoError(instance.Restart(ctx))

	clusters, err := kiali.Clusters()
	require.NoError(err)

	// Ensure the inaccessible cluster/kiali instance is shown in the clusters response.
	require.Greater(len(clusters), len(originalClusters))

	inaccessibleIdx := slices.IndexFunc(clusters, func(c kubernetes.Cluster) bool { return c.Name == "inaccessible" })
	require.NotEqualf(-1, inaccessibleIdx, "inaccessible cluster not found in clusters response")
}
