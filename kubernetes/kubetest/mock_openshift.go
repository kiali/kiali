package kubetest

import (
	"context"

	osapps_v1 "github.com/openshift/api/apps/v1"
	osoauth_v1 "github.com/openshift/api/oauth/v1"
	osroutes_v1 "github.com/openshift/api/route/v1"
	osuser_v1 "github.com/openshift/api/user/v1"
)

func (o *K8SClientMock) GetRoute(ctx context.Context, namespace string, name string) (*osroutes_v1.Route, error) {
	args := o.Called(ctx, namespace, name)
	return args.Get(0).(*osroutes_v1.Route), args.Error(1)
}

func (o *K8SClientMock) GetDeploymentConfig(ctx context.Context, namespace string, name string) (*osapps_v1.DeploymentConfig, error) {
	args := o.Called(namespace, name)
	return args.Get(0).(*osapps_v1.DeploymentConfig), args.Error(1)
}

func (o *K8SClientMock) GetDeploymentConfigs(ctx context.Context, namespace string) ([]osapps_v1.DeploymentConfig, error) {
	args := o.Called(namespace)
	return args.Get(0).([]osapps_v1.DeploymentConfig), args.Error(1)
}

func (o *K8SClientMock) DeleteOAuthToken(ctx context.Context, token string) error {
	args := o.Called(ctx, token)
	return args.Error(0)
}

func (o *K8SClientMock) GetOAuthClient(ctx context.Context, name string) (*osoauth_v1.OAuthClient, error) {
	args := o.Called(ctx, name)
	return args.Get(0).(*osoauth_v1.OAuthClient), args.Error(1)
}

func (o *K8SClientMock) GetUser(ctx context.Context, name string) (*osuser_v1.User, error) {
	args := o.Called(ctx, name)
	return args.Get(0).(*osuser_v1.User), args.Error(1)
}
