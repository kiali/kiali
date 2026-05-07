package client

import (
	"fmt"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/tools/clientcmd"
	crclient "sigs.k8s.io/controller-runtime/pkg/client"
)

type KubeContextClient interface {
	crclient.Client
	KubeContext() string
}

type kubeContextClient struct {
	crclient.Client
	kubeContext string
}

func (c *kubeContextClient) KubeContext() string {
	return c.kubeContext
}

func ClientForContext(kubeContext string) (KubeContextClient, error) {
	rules := clientcmd.NewDefaultClientConfigLoadingRules()
	config, err := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(
		rules,
		&clientcmd.ConfigOverrides{CurrentContext: kubeContext},
	).ClientConfig()
	if err != nil {
		return nil, fmt.Errorf("building rest config for %s: %w", kubeContext, err)
	}

	s := runtime.NewScheme()
	_ = corev1.AddToScheme(s)

	cl, err := crclient.New(config, crclient.Options{Scheme: s})
	if err != nil {
		return nil, fmt.Errorf("creating client for %s: %w", kubeContext, err)
	}

	return &kubeContextClient{Client: cl, kubeContext: kubeContext}, nil
}
