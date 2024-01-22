package kube

import (
	"testing"

	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"

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
