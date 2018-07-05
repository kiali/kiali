package kubetest

import (
	"github.com/stretchr/testify/mock"
	"k8s.io/api/core/v1"

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

func (o *K8SClientMock) GetFullServices(namespace string) (*kubernetes.ServiceList, error) {
	args := o.Called(namespace)
	return args.Get(0).(*kubernetes.ServiceList), args.Error(1)
}

func (o *K8SClientMock) GetServices(namespace string) (*v1.ServiceList, error) {
	args := o.Called(namespace)
	return args.Get(0).(*v1.ServiceList), args.Error(1)
}

func (o *K8SClientMock) GetPods(namespace, labelSelector string) (*v1.PodList, error) {
	args := o.Called(namespace, labelSelector)
	return args.Get(0).(*v1.PodList), args.Error(1)
}

func (o *K8SClientMock) GetNamespacePods(namespace string) (*v1.PodList, error) {
	args := o.Called(namespace)
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

func (o *K8SClientMock) GetGateways(namespace string) ([]kubernetes.IstioObject, error) {
	args := o.Called(namespace)
	return args.Get(0).([]kubernetes.IstioObject), args.Error(1)
}

func (o *K8SClientMock) GetGateway(namespace string, gateway string) (kubernetes.IstioObject, error) {
	args := o.Called(namespace, gateway)
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

func (o *K8SClientMock) GetServiceEntries(namespace string) ([]kubernetes.IstioObject, error) {
	args := o.Called(namespace)
	return args.Get(0).([]kubernetes.IstioObject), args.Error(1)
}

func (o *K8SClientMock) GetServiceEntry(namespace string, serviceEntryName string) (kubernetes.IstioObject, error) {
	args := o.Called(namespace, serviceEntryName)
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

func (o *K8SClientMock) GetQuotaSpecs(namespace string) ([]kubernetes.IstioObject, error) {
	args := o.Called(namespace)
	return args.Get(0).([]kubernetes.IstioObject), args.Error(1)
}

func (o *K8SClientMock) GetQuotaSpec(namespace string, quotaSpecName string) (kubernetes.IstioObject, error) {
	args := o.Called(namespace, quotaSpecName)
	return args.Get(0).(kubernetes.IstioObject), args.Error(1)
}

func (o *K8SClientMock) GetQuotaSpecBindings(namespace string) ([]kubernetes.IstioObject, error) {
	args := o.Called(namespace)
	return args.Get(0).([]kubernetes.IstioObject), args.Error(1)
}

func (o *K8SClientMock) GetQuotaSpecBinding(namespace string, quotaSpecBindingName string) (kubernetes.IstioObject, error) {
	args := o.Called(namespace, quotaSpecBindingName)
	return args.Get(0).(kubernetes.IstioObject), args.Error(1)
}
