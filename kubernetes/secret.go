package kubernetes

import (
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/clientcmd/api"
)

func GetRemoteSecret(path string) (*api.Config, error) {
	return clientcmd.LoadFromFile(path)
}

// GetSecret fetches and returns the specified Secret definition
// from the cluster
func (in *K8SClient) GetSecret(namespace, name string) (*core_v1.Secret, error) {
	configMap, err := in.k8s.CoreV1().Secrets(namespace).Get(in.ctx, name, emptyGetOptions)
	if err != nil {
		return &core_v1.Secret{}, err
	}

	return configMap, nil
}
