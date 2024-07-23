package kube

import (
	"context"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/kubernetes"

	"github.com/kiali/kiali/log"
)

// WaitForDeploymentReady waits for a deployment to be fully rolled out and ready.
func WaitForDeploymentReady(ctx context.Context, clientset kubernetes.Interface, namespace, deploymentName string) error {
	timeout := 5 * time.Minute
	pollInterval := 10 * time.Second

	return wait.PollUntilContextTimeout(ctx, pollInterval, timeout, true, func(ctx context.Context) (bool, error) {
		deployment, err := clientset.AppsV1().Deployments(namespace).Get(ctx, deploymentName, metav1.GetOptions{})
		if err != nil {
			return false, err
		}

		if deployment.Generation != deployment.Status.ObservedGeneration {
			log.Debug("The deployment has not observed the latest spec update yet.")
			return false, nil
		}

		if deployment.Status.Replicas != *deployment.Spec.Replicas {
			log.Debugf("Waiting for deployment to be fully rolled out (%d/%d replicas)", deployment.Status.Replicas, *deployment.Spec.Replicas)
			return false, nil
		}

		if deployment.Status.UpdatedReplicas != *deployment.Spec.Replicas {
			log.Debugf("Waiting for deployment to be updated (%d/%d replicas)", deployment.Status.UpdatedReplicas, *deployment.Spec.Replicas)
			return false, nil
		}

		if deployment.Status.ReadyReplicas != *deployment.Spec.Replicas {
			log.Debugf("Waiting for deployment to be ready (%d/%d replicas)", deployment.Status.ReadyReplicas, *deployment.Spec.Replicas)
			return false, nil
		}

		return true, nil
	})
}
