package kubetest

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/stretchr/testify/mock"
)

type K8SClientMock struct {
	mock.Mock
}

func (o *K8SClientMock) GetServices(namespaceName string) (*kubernetes.ServiceList, error) {
	args := o.Called(namespaceName)
	return args.Get(0).(*kubernetes.ServiceList), args.Error(1)
}

func (o *K8SClientMock) GetServiceDetails(namespace string, serviceName string) (*kubernetes.ServiceDetails, error) {
	args := o.Called(namespace, serviceName)
	return args.Get(0).(*kubernetes.ServiceDetails), args.Error(1)
}

func (o *K8SClientMock) GetIstioDetails(namespace string, serviceName string) (*kubernetes.IstioDetails, error) {
	args := o.Called(namespace, serviceName)
	return args.Get(0).(*kubernetes.IstioDetails), args.Error(1)
}
