package kubetest

import "github.com/kiali/kiali/kubernetes"

func (o *K8SClientMock) CreateIter8Experiment(namespace string, json string) (kubernetes.Iter8Experiment, error) {
	args := o.Called(namespace, json)
	return args.Get(0).(kubernetes.Iter8Experiment), args.Error(1)
}

func (o *K8SClientMock) UpdateIter8Experiment(namespace string, name string, json string) (kubernetes.Iter8Experiment, error) {
	args := o.Called(namespace, name, json)
	return args.Get(0).(kubernetes.Iter8Experiment), args.Error(1)
}


func (o *K8SClientMock) GetIter8Experiment(namespace string, name string) (kubernetes.Iter8Experiment, error) {
	args := o.Called(namespace, name)
	return args.Get(0).(kubernetes.Iter8Experiment), args.Error(1)
}

func (o *K8SClientMock) GetIter8Experiments(namespace string) ([]kubernetes.Iter8Experiment, error) {
	args := o.Called(namespace)
	return args.Get(0).([]kubernetes.Iter8Experiment), args.Error(1)
}

func (o *K8SClientMock) IsIter8Api() bool {
	args := o.Called()
	return args.Get(0).(bool)
}

func (o *K8SClientMock) DeleteIter8Experiment(namespace string, name string) error {
	args := o.Called(namespace, name)
	return args.Error(0)
}

func (o *K8SClientMock) Iter8ConfigMap() ([]string, error) {
	args := o.Called()
	return args.Get(0).([]string), args.Error(1)
}
