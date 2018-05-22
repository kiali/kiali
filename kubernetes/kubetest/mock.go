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

func (o *K8SClientMock) GetNamespaces() (*v1.NamespaceList, error) {
	args := o.Called()
	return args.Get(0).(*v1.NamespaceList), args.Error(1)
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

func (o *K8SClientMock) GetRouteRules(namespace string, serviceName string) ([]kubernetes.IstioObject, error) {
	args := o.Called(namespace, serviceName)
	return args.Get(0).([]kubernetes.IstioObject), args.Error(1)
}
func (o *K8SClientMock) GetRouteRule(namespace string, routerule string) (kubernetes.IstioObject, error) {
	args := o.Called(namespace, routerule)
	return args.Get(0).(kubernetes.IstioObject), args.Error(1)
}

func (o *K8SClientMock) GetDestinationPolicies(namespace string, serviceName string) ([]kubernetes.IstioObject, error) {
	args := o.Called(namespace, serviceName)
	return args.Get(0).([]kubernetes.IstioObject), args.Error(1)
}

func (o *K8SClientMock) GetDestinationPolicy(namespace string, destinationpolicy string) (kubernetes.IstioObject, error) {
	args := o.Called(namespace, destinationpolicy)
	return args.Get(0).(kubernetes.IstioObject), args.Error(1)
}

func (o *K8SClientMock) GetVirtualServices(namespace string, serviceName string) ([]kubernetes.IstioObject, error) {
	args := o.Called(namespace, serviceName)
	return args.Get(0).([]kubernetes.IstioObject), args.Error(1)
}

func (o *K8SClientMock) GetVirtualService(namespace string, virtualservice string) (kubernetes.IstioObject, error) {
	args := o.Called(namespace, virtualservice)
	return args.Get(0).(kubernetes.IstioObject), args.Error(1)
}

func (o *K8SClientMock) GetDestinationRules(namespace string, serviceName string) ([]kubernetes.IstioObject, error) {
	args := o.Called(namespace, serviceName)
	return args.Get(0).([]kubernetes.IstioObject), args.Error(1)
}

func (o *K8SClientMock) GetDestinationRule(namespace string, destinationrule string) (kubernetes.IstioObject, error) {
	args := o.Called(namespace, destinationrule)
	return args.Get(0).(kubernetes.IstioObject), args.Error(1)
}

func (o *K8SClientMock) GetIstioRules(namespace string) (*kubernetes.IstioRules, error) {
	args := o.Called(namespace)
	return args.Get(0).(*kubernetes.IstioRules), args.Error(1)
}

func (o *K8SClientMock) GetIstioRuleDetails(namespace string, istiorule string) (*kubernetes.IstioRuleDetails, error) {
	args := o.Called(namespace, istiorule)
	return args.Get(0).(*kubernetes.IstioRuleDetails), args.Error(1)
}
