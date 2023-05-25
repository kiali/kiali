package utils

import (
	"context"
	"github.com/stretchr/testify/require"
	"testing"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"

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

// Deletes the existing kiali Pod and waits for the new one to be ready.
func RestartKialiPod(ctx context.Context, kubeClient kubernetes.Interface, namespace string, keepOldPod bool, currentKialiPod string) error {
	log.Debugf("Restarting kiali pod %s %s", namespace, currentKialiPod)

	// Restart Kiali pod when kiali CRD does not exist (Otherwise, operator will delete the old one)
	if !keepOldPod {
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

func GetKialiPodName(kubeClient kubernetes.Interface, kialiNamespace string, ctx context.Context, t *testing.T) string {

	require := require.New(t)
	pods, err := kubeClient.CoreV1().Pods(kialiNamespace).List(ctx, metav1.ListOptions{LabelSelector: "app=kiali"})
	require.NoError(err)
	require.Len(pods.Items, 1)

	return pods.Items[0].Name
}
