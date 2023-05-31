package utils

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v2"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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

func RestartKialiPod(ctx context.Context, kubeClient kubernetes.Interface, namespace string, keepOldPod bool, t *testing.T) error {
	kialiPodName := GetKialiPodName(kubeClient, namespace, ctx, t)
	return RestartKialiPodName(ctx, kubeClient, namespace, keepOldPod, kialiPodName)
}

// Deletes the existing kiali Pod and waits for the new one to be ready.
func RestartKialiPodName(ctx context.Context, kubeClient kubernetes.Interface, namespace string, keepOldPod bool, currentKialiPod string) error {
	log.Debugf("Restarting kiali pod %s %s", namespace, currentKialiPod)

	// Restart Kiali pod when kiali CRD does not exist (Otherwise, operator will delete the old one)
	if !keepOldPod {
		log.Debugf("Deleting Kiali pod %s", currentKialiPod)
		err := kubeClient.CoreV1().Pods(namespace).Delete(ctx, currentKialiPod, metav1.DeleteOptions{})
		if err != nil {
			log.Errorf("Error deleting Kiali pod %s", err)
			return err
		}
	}

	return wait.PollImmediate(time.Second*5, time.Minute*4, func() (bool, error) {
		log.Debugf("Waiting for kiali to be ready")
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
func GetKialiConfigMap(kubeClient kubernetes.Interface, kialiNamespace string, kialiName string, ctx context.Context, t *testing.T) (*config.Config, *v1.ConfigMap) {

	require := require.New(t)

	// Update the configmap directly by getting the configmap and patching it.
	cm, err := kubeClient.CoreV1().ConfigMaps(kialiNamespace).Get(ctx, kialiName, metav1.GetOptions{})
	require.NoError(err)

	currentConfig := config.NewConfig()
	require.NoError(yaml.Unmarshal([]byte(cm.Data["config.yaml"]), currentConfig))

	return currentConfig, cm
}

// Update Kiali config map
func UpdateKialiConfigMap(kubeClient kubernetes.Interface, kialiNamespace string, currentConfig *config.Config, cm *v1.ConfigMap, ctx context.Context, t *testing.T) {

	require := require.New(t)

	newConfig, err := yaml.Marshal(currentConfig)
	require.NoError(err)
	cm.Data["config.yaml"] = string(newConfig)

	_, err = kubeClient.CoreV1().ConfigMaps(kialiNamespace).Update(ctx, cm, metav1.UpdateOptions{})
	require.NoError(err)
}
