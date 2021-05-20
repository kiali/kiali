package business

import (
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/kubernetes"
)

type RegistryStatusService struct {
	k8s           kubernetes.ClientInterface
	businessLayer *Layer
}

func (in *RegistryStatusService) GetRegistryStatus() ([]*kubernetes.RegistryStatus, error) {
	if kialiCache == nil {
		return nil, nil
	}

	if kialiCache.CheckRegistryStatus() {
		return kialiCache.GetRegistryStatus(), nil
	}

	var registryStatus []*kubernetes.RegistryStatus
	var err error

	if registryStatus, err = in.k8s.GetRegistryStatus(); err != nil {
		if registryStatus, err = in.getRegistryStatusUsingKialiSA(); err != nil {
			return nil, err
		}
	}

	kialiCache.SetRegistryStatus(registryStatus)
	return kialiCache.GetRegistryStatus(), nil
}

func (in *RegistryStatusService) getRegistryStatusUsingKialiSA() ([]*kubernetes.RegistryStatus, error) {
	clientFactory, err := kubernetes.GetClientFactory()
	if err != nil {
		return nil, err
	}

	kialiToken, err := kubernetes.GetKialiToken()
	if err != nil {
		return nil, err
	}

	k8s, err := clientFactory.GetClient(&api.AuthInfo{Token: kialiToken})
	if err != nil {
		return nil, err
	}

	return k8s.GetRegistryStatus()
}