package kubetest

import (
	osapps_v1 "github.com/openshift/api/apps/v1"
	osproject_v1 "github.com/openshift/api/project/v1"
	osroutes_v1 "github.com/openshift/api/route/v1"
)

func (o *K8SClientMock) GetRoute(namespace, name string) (*osroutes_v1.Route, error) {
	args := o.Called(namespace, name)
	return args.Get(0).(*osroutes_v1.Route), args.Error(1)
}

func (o *K8SClientMock) GetDeploymentConfig(namespace string, name string) (*osapps_v1.DeploymentConfig, error) {
	args := o.Called(namespace, name)
	return args.Get(0).(*osapps_v1.DeploymentConfig), args.Error(1)
}

func (o *K8SClientMock) GetDeploymentConfigs(namespace string) ([]osapps_v1.DeploymentConfig, error) {
	args := o.Called(namespace)
	return args.Get(0).([]osapps_v1.DeploymentConfig), args.Error(1)
}

func (o *K8SClientMock) GetProject(project string) (*osproject_v1.Project, error) {
	args := o.Called(project)
	return args.Get(0).(*osproject_v1.Project), args.Error(1)
}

func (o *K8SClientMock) GetProjects(labelSelector string) ([]osproject_v1.Project, error) {
	args := o.Called(labelSelector)
	return args.Get(0).([]osproject_v1.Project), args.Error(1)
}

func (o *K8SClientMock) UpdateProject(project string, jsonPatch string) (*osproject_v1.Project, error) {
	args := o.Called(project)
	return args.Get(0).(*osproject_v1.Project), args.Error(1)
}
