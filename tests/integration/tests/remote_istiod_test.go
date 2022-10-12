package tests

import (
	"context"
	"path"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	kubeerrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/apimachinery/pkg/util/yaml"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"

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
	proxyPatch, err := yaml.ToJSON(kialiKube.ReadFile(t, proxyPatchPath))
	require.NoError(err)

	kubeClient := kubeClient(t)
	dynamicClient := dynamicClient(t)
	kialiGVR := schema.GroupVersionResource{Group: "kiali.io", Version: "v1alpha1", Resource: "kialis"}

	deadline, _ := t.Deadline()
	ctx, cancel := context.WithDeadline(context.Background(), deadline)
	// This is used by cleanup so needs to be added to cleanup instead of deferred.
	t.Cleanup(cancel)

	// Find the Kiali CR
	kialiCRs, err := dynamicClient.Resource(kialiGVR).List(ctx, metav1.ListOptions{})
	require.NoError(err)

	kialiName := kialiCRs.Items[0].GetName()
	kialiNamespace := kialiCRs.Items[0].GetNamespace()


	// Register clean up before creating resources in case of failure.
	t.Cleanup(func() {
		log.Debug("Cleaning up resources from RemoteIstiod test")
		undoRegistryPatch := []byte(`[{"op": "remove", "path": "/spec/external_services/istio/registry"}]`)
		_, err = dynamicClient.Resource(kialiGVR).Namespace(kialiNamespace).Patch(ctx, kialiName, types.JSONPatchType, undoRegistryPatch, metav1.PatchOptions{})
		require.NoError(err)

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
			cm, err := kubeClient.CoreV1().ConfigMaps("istio-system").Get(ctx, "kiali", metav1.GetOptions{})
			if err != nil {
				return false, err
			}
			return !strings.Contains(cm.Data["config.yaml"], "http://istiod-debug.istio-system:9240"), nil
		}), "Error waiting for kiali configmap to update")
	})

	// Expose the istiod /debug endpoints by adding a proxy to the pod.
	log.Debug("Patching istiod deployment with proxy")
	_, err = kubeClient.AppsV1().Deployments("istio-system").Patch(ctx, "istiod", types.StrategicMergePatchType, proxyPatch, metav1.PatchOptions{})
	require.NoError(err)
	log.Debug("Successfully patched istiod deployment with proxy")

	// Then create a service for the proxy/debug endpoint.
	require.True(utils.ApplyFile(assetsFolder+"/remote-istiod/istiod-debug-service.yaml", "istio-system"), "Could not create istiod debug service")

	// Now patch kiali to use that remote endpoint.
	registryPatch := []byte(`{"spec": {"external_services": {"istio": {"registry": {"istiod_url": "http://istiod-debug.istio-system:9240"}}}}}`)
	log.Debug("Patching kiali to use remote istiod")
	_, err = dynamicClient.Resource(kialiGVR).Namespace(kialiNamespace).Patch(ctx, kialiName, types.MergePatchType, registryPatch, metav1.PatchOptions{})
	require.NoError(err)
	log.Debug("Successfully patched kiali to use remote istiod")

	// Need to know when the kiali operator has seen the CR change and finished updating
	// the configmap. There's no ObservedGeneration on the Kiali CR so just checking the configmap itself.
	require.NoError(wait.PollImmediate(time.Second*5, time.Minute*2, func() (bool, error) {
		cm, err := kubeClient.CoreV1().ConfigMaps("istio-system").Get(ctx, "kiali", metav1.GetOptions{})
		if err != nil {
			return false, err
		}
		return strings.Contains(cm.Data["config.yaml"], "http://istiod-debug.istio-system:9240"), nil
	}), "Error waiting for kiali configmap to update")

	// Now wait for the kiali pod to be ready.
	require.NoError(wait.PollImmediate(time.Second*5, time.Minute*2, func() (bool, error) {
		log.Debug("Waiting for kiali to be ready")
		kiali, err := dynamicClient.Resource(kialiGVR).Namespace(kialiNamespace).Get(ctx, kialiName, metav1.GetOptions{})
		if err != nil {
			return false, err
		}

		conditions := kiali.Object["status"].(map[string]interface{})["conditions"].([]interface{})
		kialiUpdated := false
		for _, condition := range conditions {
			cond := condition.(map[string]interface{})
			if cond["type"] == "Successful" && cond["status"] == "True" {
				kialiUpdated = true
			}
		}
		if !kialiUpdated {
			log.Debug("kiali has not finished reconciling yet")
			return false, nil
		}

		deployment, err := kubeClient.AppsV1().Deployments("istio-system").Get(ctx, "kiali", metav1.GetOptions{})
		if err != nil {
			return false, err
		}

		podsUpdatedAndRunning := deployment.Status.ReadyReplicas > 0 && deployment.Status.UpdatedReplicas > 0
		if !podsUpdatedAndRunning {
			log.Debug("kiali pods have not finished updating yet")
		}
		return podsUpdatedAndRunning, nil
	}), "Error waiting for kiali deployment to update")

	configs, err := utils.IstioConfigs()
	require.NoError(err)
	require.NotEmpty(configs)
}
