package kubetest

import (
	"github.com/kiali/kiali/kubernetes"
)

func (o *K8SClientMock) CreateIstioObject(api, namespace, resourceType, json string) (kubernetes.IstioObject, error) {
	args := o.Called(api, namespace, resourceType, json)
	return args.Get(0).(kubernetes.IstioObject), args.Error(1)
}

func (o *K8SClientMock) DeleteIstioObject(api, namespace, objectType, objectName string) error {
	args := o.Called(api, namespace, objectType, objectName)
	return args.Error(0)
}

func (o *K8SClientMock) GetIstioObject(namespace string, resourceType string, object string) (kubernetes.IstioObject, error) {
	args := o.Called(namespace, resourceType, object)
	return args.Get(0).(kubernetes.IstioObject), args.Error(1)
}

func (o *K8SClientMock) GetIstioObjects(namespace, resourceType, labelSelector string) ([]kubernetes.IstioObject, error) {
	args := o.Called(namespace, resourceType, labelSelector)
	return args.Get(0).([]kubernetes.IstioObject), args.Error(1)
}

func (o *K8SClientMock) UpdateIstioObject(api, namespace, resourceType, name, jsonPatch string) (kubernetes.IstioObject, error) {
	args := o.Called(api, namespace, resourceType, name, jsonPatch)
	return args.Get(0).(kubernetes.IstioObject), args.Error(1)
}

func (o *K8SClientMock) GetProxyStatus() ([]*kubernetes.ProxyStatus, error) {
	args := o.Called()
	return args.Get(0).([]*kubernetes.ProxyStatus), args.Error(1)
}

func (o *K8SClientMock) GetConfigDump(namespace string, podName string) (*kubernetes.ConfigDump, error) {
	args := o.Called(namespace, podName)
	return args.Get(0).(*kubernetes.ConfigDump), args.Error(1)
}
