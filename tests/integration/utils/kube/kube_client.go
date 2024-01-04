package kube

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v2"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/tools/cmd"
)

func NewDynamicClient(t *testing.T) dynamic.Interface {
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

func NewKubeClient(t *testing.T) kubernetes.Interface {
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

func DeleteKialiPod(ctx context.Context, kubeClient kubernetes.Interface, namespace string, currentKialiPod string) error {
	log.Debugf("Deleting Kiali pod %s", currentKialiPod)
	err := kubeClient.CoreV1().Pods(namespace).Delete(ctx, currentKialiPod, metav1.DeleteOptions{})
	if err != nil {
		log.Errorf("Error deleting Kiali pod %s", err)
		return err
	}
	return nil
}

// Waits for old kiali pod to terminate and for the new one to be ready
func RestartKialiPod(ctx context.Context, kubeClient kubernetes.Interface, namespace string, currentKialiPod string) error {
	return wait.PollUntilContextTimeout(ctx, time.Second*5, time.Minute*4, true, func(ctx context.Context) (bool, error) {
		log.Debugf("Waiting for kiali pod %s in %s namespace to be ready", currentKialiPod, namespace)
		pods, err := kubeClient.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{LabelSelector: "app=kiali"})
		if err != nil {
			log.Errorf("Error getting the pods list %s", err)
			return false, err
		} else {
			log.Debugf("Found %d pods", len(pods.Items))
		}

		for _, pod := range pods.Items {
			if pod.Name == currentKialiPod {
				log.Debug("Old kiali pod still exists.")
				return false, nil
			}
			for _, condition := range pod.Status.Conditions {
				if condition.Type == "Ready" && condition.Status == "False" {
					log.Debugf("New kiali pod is not ready.")
					log.Debugf("Condition type %s status %s pod name %s", condition.Type, condition.Status, pod.Name)
					return false, nil
				}
			}
		}
		return true, nil
	})
}

// Returns the name of the Kiali pod
// It expects to find just one Kiali pod
func GetKialiPodName(ctx context.Context, kubeClient kubernetes.Interface, kialiNamespace string, t *testing.T) string {
	require := require.New(t)
	pods, err := kubeClient.CoreV1().Pods(kialiNamespace).List(ctx, metav1.ListOptions{LabelSelector: "app=kiali"})
	require.NoError(err)
	require.Len(pods.Items, 1)

	return pods.Items[0].Name
}

// Get Kiali config map
func GetKialiConfigMap(ctx context.Context, kubeClient kubernetes.Interface, kialiNamespace string, kialiName string, t *testing.T) (*config.Config, *v1.ConfigMap) {
	require := require.New(t)

	// Update the configmap directly by getting the configmap and patching it.
	cm, err := kubeClient.CoreV1().ConfigMaps(kialiNamespace).Get(ctx, kialiName, metav1.GetOptions{})
	require.NoError(err)

	currentConfig := config.NewConfig()
	require.NoError(yaml.Unmarshal([]byte(cm.Data["config.yaml"]), currentConfig))

	return currentConfig, cm
}

func UpdateKialiCR(ctx context.Context, dynamicClient dynamic.Interface, kubeClient kubernetes.Interface,
	kialiNamespace string, check string, registryPatch []byte, t *testing.T,
) {
	require := require.New(t)
	kialiGVR := schema.GroupVersionResource{Group: "kiali.io", Version: "v1alpha1", Resource: "kialis"}
	// Find the Kiali CR and override some settings if they're set on the CR.
	kialiCRs, err := dynamicClient.Resource(kialiGVR).List(ctx, metav1.ListOptions{})
	require.NoError(err)

	kialiCR := kialiCRs.Items[0]

	kialiName := kialiCR.GetName()
	kialiDeploymentNamespace := kialiNamespace
	kialiNamespace = kialiCR.GetNamespace()
	if spec, ok := kialiCR.Object["spec"].(map[string]interface{}); ok {
		if deployment, ok := spec["deployment"].(map[string]interface{}); ok {
			if namespace, ok := deployment["namespace"].(string); ok {
				kialiDeploymentNamespace = namespace
			}
		}
	}

	_, err = dynamicClient.Resource(kialiGVR).Namespace(kialiNamespace).Patch(ctx, kialiName, types.MergePatchType, registryPatch, metav1.PatchOptions{})
	require.NoError(err)

	// Need to know when the kiali operator has seen the CR change and finished updating
	// the configmap. There's no ObservedGeneration on the Kiali CR so just checking the configmap itself.
	require.NoError(wait.PollUntilContextTimeout(ctx, time.Second*5, time.Minute*2, true, func(ctx context.Context) (bool, error) {
		log.Debug("Waiting for kiali configmap to update")
		cm, err := kubeClient.CoreV1().ConfigMaps(kialiDeploymentNamespace).Get(ctx, kialiName, metav1.GetOptions{})
		if err != nil {
			return false, err
		}
		return strings.Contains(cm.Data["config.yaml"], check), nil
	}), "Error waiting for kiali configmap to update")
}

// Update Kiali config map
func UpdateKialiConfigMap(ctx context.Context, kubeClient kubernetes.Interface, kialiNamespace string, currentConfig *config.Config, cm *v1.ConfigMap, t *testing.T) {
	require := require.New(t)

	newConfig, err := yaml.Marshal(currentConfig)
	require.NoError(err)
	cm.Data["config.yaml"] = string(newConfig)

	_, err = kubeClient.CoreV1().ConfigMaps(kialiNamespace).Update(ctx, cm, metav1.UpdateOptions{})
	require.NoError(err)
}
