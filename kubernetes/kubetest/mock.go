package kubetest

import (
	"github.com/stretchr/testify/mock"
	"k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/kubernetes"
)

type K8SClientMock struct {
	mock.Mock
}

func (o *K8SClientMock) GetService(namespace string, serviceName string) (*v1.Service, error) {
	args := o.Called(namespace, serviceName)
	return args.Get(0).(*v1.Service), args.Error(1)
}

func (o *K8SClientMock) GetServices(namespace string) (*kubernetes.ServiceList, error) {
	args := o.Called(namespace)
	return args.Get(0).(*kubernetes.ServiceList), args.Error(1)
}

func (o *K8SClientMock) GetPods(namespace string, labelsSet labels.Set) (*v1.PodList, error) {
	args := o.Called(namespace, labelsSet)
	return args.Get(0).(*v1.PodList), args.Error(1)
}

func (o *K8SClientMock) GetServiceDetails(namespace string, serviceName string) (*kubernetes.ServiceDetails, error) {
	args := o.Called(namespace, serviceName)
	return args.Get(0).(*kubernetes.ServiceDetails), args.Error(1)
}

func (o *K8SClientMock) GetServicePods(namespace string, serviceName string, serviceVersion string) (*v1.PodList, error) {
	args := o.Called(namespace, serviceName, serviceVersion)
	return args.Get(0).(*v1.PodList), args.Error(1)
}

func (o *K8SClientMock) GetIstioDetails(namespace string, serviceName string) (*kubernetes.IstioDetails, error) {
	args := o.Called(namespace, serviceName)
	return args.Get(0).(*kubernetes.IstioDetails), args.Error(1)
}
