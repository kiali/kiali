package tests

import (
	"context"
	"path"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v2"
	kubeerrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/wait"
	kubeyaml "k8s.io/apimachinery/pkg/util/yaml"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"

	"github.com/kiali/kiali/config"
	kialiKube "github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/tests/integration/utils"
	"github.com/kiali/kiali/tools/cmd"
)

var assetsFolder = path.Join(cmd.KialiProjectRoot, utils.ASSETS)

func dynamicClient(t *testing.T) dynamic.Interface {
	t.Helper()

	cfg, err := cmd.GetKubeConfig()
	if err != nil {
		t.Fatalf("Error getting kube config: %v", err)
	}

	client, err := dynamic.NewForConfig(cfg)
	if err != nil {
		t.Fatalf("Error creating dynamic client: %v", err)
	}

	return client
}

func kubeClient(t *testing.T) kubernetes.Interface {
	t.Helper()

	cfg, err := cmd.GetKubeConfig()
	if err != nil {
		t.Fatalf("Error getting kube config: %v", err)
	}

	client, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		t.Fatalf("Error creating kube client: %v", err)
	}

	return client
}

// Testing a remote istiod by exposing /debug endpoints through a proxy.
// It assumes you've deployed Kiali through the operator.
func TestRemoteIstiod(t *testing.T) {
	require := require.New(t)

	proxyPatchPath := path.Join(assetsFolder + "/remote-istiod/proxy-patch.yaml")
	proxyPatch, err := kubeyaml.ToJSON(kialiKube.ReadFile(t, proxyPatchPath))
	require.NoError(err)

	kubeClient := kubeClient(t)
	dynamicClient := dynamicClient(t)
	kialiGVR := schema.GroupVersionResource{Group: "kiali.io", Version: "v1alpha1", Resource: "kialis"}

	deadline, _ := t.Deadline()
	ctx, cancel := context.WithDeadline(context.Background(), deadline)
	// This is used by cleanup so needs to be added to cleanup instead of deferred.
	t.Cleanup(cancel)

	var kialiCRDExists bool
	_, err = kubeClient.Discovery().RESTClient().Get().AbsPath("/apis/kiali.io").DoRaw(ctx)
	if !kubeerrors.IsNotFound(err) {
		require.NoError(err)
		kialiCRDExists = true
	}

	if kialiCRDExists {
		log.Debug("Kiali CRD found. Assuming Kiali is deployed through the operator.")
	} else {
		log.Debug("Kiali CRD not found. Assuming Kiali is deployed through helm.")
	}

	kialiName := "kiali"
	kialiNamespace := "istio-system"
	kialiDeploymentNamespace := kialiNamespace

	if kialiCRDExists {
		// Find the Kiali CR and override some settings if they're set on the CR.
		kialiCRs, err := dynamicClient.Resource(kialiGVR).List(ctx, metav1.ListOptions{})
		require.NoError(err)

		kialiCR := kialiCRs.Items[0]

		kialiName = kialiCR.GetName()
		kialiNamespace = kialiCR.GetNamespace()
		if spec, ok := kialiCR.Object["spec"].(map[string]interface{}); ok {
			if deployment, ok := spec["deployment"].(map[string]interface{}); ok {
				if namespace, ok := deployment["namespace"].(string); ok {
					kialiDeploymentNamespace = namespace
				}
			}
		}
	}

	// Register clean up before creating resources in case of failure.
	t.Cleanup(func() {
		log.Debug("Cleaning up resources from RemoteIstiod test")
		if kialiCRDExists {
			undoRegistryPatch := []byte(`[{"op": "remove", "path": "/spec/external_services/istio/registry"}]`)
			_, err = dynamicClient.Resource(kialiGVR).Namespace(kialiNamespace).Patch(ctx, kialiName, types.JSONPatchType, undoRegistryPatch, metav1.PatchOptions{})
			require.NoError(err)
		} else {
			// Update the configmap directly by getting the configmap and patching it.
			cm, err := kubeClient.CoreV1().ConfigMaps(kialiDeploymentNamespace).Get(ctx, kialiName, metav1.GetOptions{})
			require.NoError(err)

			var currentConfig config.Config
			require.NoError(yaml.Unmarshal([]byte(cm.Data["config.yaml"]), &currentConfig))
			currentConfig.ExternalServices.Istio.Registry = nil

			newConfig, err := yaml.Marshal(currentConfig)
			require.NoError(err)
			cm.Data["config.yaml"] = string(newConfig)

			_, err = kubeClient.CoreV1().ConfigMaps(kialiNamespace).Update(ctx, cm, metav1.UpdateOptions{})
			require.NoError(err)

			// Restart Kiali pod to pick up the new config.
			require.NoError(restartKialiPod(ctx, kubeClient, kialiNamespace))
		}

		// Remove service:
		err = kubeClient.CoreV1().Services("istio-system").Delete(ctx, "istiod-debug", metav1.DeleteOptions{})
		if kubeerrors.IsNotFound(err) {
			err = nil
		}
		require.NoError(err)

		// Remove nginx container
		istiod, err := kubeClient.AppsV1().Deployments("istio-system").Get(ctx, "istiod", metav1.GetOptions{})
		require.NoError(err)

		for i, container := range istiod.Spec.Template.Spec.Containers {
			if container.Name == "nginx" {
				istiod.Spec.Template.Spec.Containers = append(istiod.Spec.Template.Spec.Containers[:i], istiod.Spec.Template.Spec.Containers[i+1:]...)
				break
			}
		}
		_, err = kubeClient.AppsV1().Deployments("istio-system").Update(ctx, istiod, metav1.UpdateOptions{})
		require.NoError(err)

		// Wait for the configmap to be updated again before exiting.
		require.NoError(wait.PollImmediate(time.Second*5, time.Minute*2, func() (bool, error) {
			cm, err := kubeClient.CoreV1().ConfigMaps(kialiDeploymentNamespace).Get(ctx, kialiName, metav1.GetOptions{})
			if err != nil {
				return false, err
			}
			return !strings.Contains(cm.Data["config.yaml"], "http://istiod-debug.istio-system:9240"), nil
		}), "Error waiting for kiali configmap to update")

		require.NoError(restartKialiPod(ctx, kubeClient, kialiDeploymentNamespace))
	})

	// Expose the istiod /debug endpoints by adding a proxy to the pod.
	log.Debug("Patching istiod deployment with proxy")
	_, err = kubeClient.AppsV1().Deployments("istio-system").Patch(ctx, "istiod", types.StrategicMergePatchType, proxyPatch, metav1.PatchOptions{})
	require.NoError(err)
	log.Debug("Successfully patched istiod deployment with proxy")

	// Then create a service for the proxy/debug endpoint.
	require.True(utils.ApplyFile(assetsFolder+"/remote-istiod/istiod-debug-service.yaml", "istio-system"), "Could not create istiod debug service")

	// Now patch kiali to use that remote endpoint.
	log.Debug("Patching kiali to use remote istiod")
	if kialiCRDExists {
		registryPatch := []byte(`{"spec": {"external_services": {"istio": {"registry": {"istiod_url": "http://istiod-debug.istio-system:9240"}}}}}`)
		_, err = dynamicClient.Resource(kialiGVR).Namespace(kialiNamespace).Patch(ctx, kialiName, types.MergePatchType, registryPatch, metav1.PatchOptions{})
		require.NoError(err)

		// Need to know when the kiali operator has seen the CR change and finished updating
		// the configmap. There's no ObservedGeneration on the Kiali CR so just checking the configmap itself.
		require.NoError(wait.PollImmediate(time.Second*5, time.Minute*2, func() (bool, error) {
			log.Debug("Waiting for kiali configmap to update")
			cm, err := kubeClient.CoreV1().ConfigMaps(kialiDeploymentNamespace).Get(ctx, kialiName, metav1.GetOptions{})
			if err != nil {
				return false, err
			}
			return strings.Contains(cm.Data["config.yaml"], "http://istiod-debug.istio-system:9240"), nil
		}), "Error waiting for kiali configmap to update")
	} else {
		// Update the configmap directly.
		cm, err := kubeClient.CoreV1().ConfigMaps(kialiDeploymentNamespace).Get(ctx, kialiName, metav1.GetOptions{})
		require.NoError(err)

		currentConfig := config.NewConfig()
		require.NoError(yaml.Unmarshal([]byte(cm.Data["config.yaml"]), currentConfig))
		currentConfig.ExternalServices.Istio.Registry = &config.RegistryConfig{
			IstiodURL: "http://istiod-debug.istio-system:9240",
		}

		newConfig, err := yaml.Marshal(currentConfig)
		require.NoError(err)
		cm.Data["config.yaml"] = string(newConfig)

		_, err = kubeClient.CoreV1().ConfigMaps(kialiDeploymentNamespace).Update(ctx, cm, metav1.UpdateOptions{})
		require.NoError(err)
	}
	log.Debug("Successfully patched kiali to use remote istiod")

	// Restart Kiali pod to pick up the new config.
	require.NoError(restartKialiPod(ctx, kubeClient, kialiDeploymentNamespace), "Error waiting for kiali deployment to update")

	configs, err := utils.IstioConfigs()
	require.NoError(err)
	require.NotEmpty(configs)
}

// Deletes the existing kiali Pod and waits for the new one to be ready.
func restartKialiPod(ctx context.Context, kubeClient kubernetes.Interface, namespace string) error {
	log.Debug("Restarting kiali pod")
	pods, err := kubeClient.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{LabelSelector: "app=kiali"})
	if err != nil {
		return err
	}
	currentKialiPod := pods.Items[0]

	err = kubeClient.CoreV1().Pods(namespace).Delete(ctx, currentKialiPod.Name, metav1.DeleteOptions{})
	if err != nil {
		return err
	}

	return wait.PollImmediate(time.Second*5, time.Minute*2, func() (bool, error) {
		log.Debug("Waiting for kiali to be ready")
		pods, err := kubeClient.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{LabelSelector: "app=kiali"})
		if err != nil {
			return false, err
		}

		for _, pod := range pods.Items {
			if pod.Name == currentKialiPod.Name {
				log.Debug("Old kiali pod still exists.")
				return false, nil
			}
			for _, condition := range pod.Status.Conditions {
				if condition.Type == "Ready" && condition.Status == "False" {
					log.Debug("New kiali pod is not ready.")
					return false, nil
				}
			}
		}

		return true, nil
	})
}
