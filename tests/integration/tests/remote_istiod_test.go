package tests

import (
	"path"
	"testing"

	"github.com/stretchr/testify/require"
	kubeerrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	kubeyaml "k8s.io/apimachinery/pkg/util/yaml"

	"github.com/kiali/kiali/config"
	kialiKube "github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/tests/integration/utils"
	"github.com/kiali/kiali/tests/integration/utils/kiali"
	"github.com/kiali/kiali/tests/integration/utils/kube"
	"github.com/kiali/kiali/tools/cmd"
)

var assetsFolder = path.Join(cmd.KialiProjectRoot, kiali.ASSETS)

// Testing a remote istiod by exposing /debug endpoints through a proxy.
func TestRemoteIstiod(t *testing.T) {
	require := require.New(t)

	proxyPatchPath := path.Join(assetsFolder + "/remote-istiod/proxy-patch.yaml")
	proxyPatch, err := kubeyaml.ToJSON(kialiKube.ReadFile(t, proxyPatchPath))
	require.NoError(err)

	kubeClient := kube.NewKubeClient(t)
	dynamicClient := kube.NewDynamicClient(t)
	ctx := contextWithTestingDeadline(t)

	instance, err := kiali.NewInstance(ctx, kubeClient, dynamicClient)
	require.NoError(err)

	originalConf, err := instance.GetConfig(ctx)
	require.NoError(err)
	// Set this to something so that the patch isn't omitted for being empty.
	originalConf.ExternalServices.Istio.Registry = &config.RegistryConfig{}

	ipods, err := kubeClient.AppsV1().Deployments(config.IstioNamespaceDefault).List(ctx, metav1.ListOptions{LabelSelector: "app=istiod"})
	istioDeploymentName := ipods.Items[0].Name

	// Register clean up before creating resources in case of failure.
	t.Cleanup(func() {
		log.Debug("Cleaning up resources from RemoteIstiod test")
		require.NoError(instance.UpdateConfig(ctx, originalConf))
		require.NoError(instance.Restart(ctx))

		// Remove service:
		err = kubeClient.CoreV1().Services(config.IstioNamespaceDefault).Delete(ctx, "istiod-debug", metav1.DeleteOptions{})
		if kubeerrors.IsNotFound(err) {
			err = nil
		}
		require.NoError(err)

		log.Debugf("Remove nginx container from istio deployment %s", istioDeploymentName)
		// Remove nginx container
		istiod, err := kubeClient.AppsV1().Deployments(config.IstioNamespaceDefault).Get(ctx, istioDeploymentName, metav1.GetOptions{})
		require.NoError(err)

		for i, container := range istiod.Spec.Template.Spec.Containers {
			if container.Name == "nginx" {
				istiod.Spec.Template.Spec.Containers = append(istiod.Spec.Template.Spec.Containers[:i], istiod.Spec.Template.Spec.Containers[i+1:]...)
				break
			}
		}
		_, err = kubeClient.AppsV1().Deployments(config.IstioNamespaceDefault).Update(ctx, istiod, metav1.UpdateOptions{})
		require.NoError(err)

		require.NoError(kube.WaitForDeploymentReady(ctx, kubeClient, config.IstioNamespaceDefault, istioDeploymentName))
		require.NoError(instance.Restart(ctx))
	})

	// Expose the istiod /debug endpoints by adding a proxy to the pod.
	log.Debugf("Patching istiod %s deployment with proxy", istioDeploymentName)
	_, err = kubeClient.AppsV1().Deployments(config.IstioNamespaceDefault).Patch(ctx, istioDeploymentName, types.StrategicMergePatchType, proxyPatch, metav1.PatchOptions{})
	require.NoError(err)
	log.Debug("Successfully patched istiod deployment with proxy")

	// Then create a service for the proxy/debug endpoint.
	require.True(utils.ApplyFile(assetsFolder+"/remote-istiod/istiod-debug-service.yaml", config.IstioNamespaceDefault), "Could not create istiod debug service")

	// Now patch kiali to use that remote endpoint.
	log.Debug("Patching kiali to use remote istiod")
	conf := *originalConf
	conf.ExternalServices.Istio.Registry = &config.RegistryConfig{
		IstiodURL: "http://istiod-debug.istio-system:9240",
	}
	// Since the current operator version doesn't support ExternalServices.Istio.Registry,
	// we need to modify the ConfigMap directly
	instance.UseKialiCR = false
	require.NoError(instance.UpdateConfig(ctx, &conf))
	require.NoError(instance.Restart(ctx))

	log.Debugf("Successfully patched kiali to use remote istiod")

	configs, err := kiali.IstioConfigs()
	require.NoError(err)
	require.NotEmpty(configs)
}
