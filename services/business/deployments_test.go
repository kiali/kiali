package business

import (
	"testing"

	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"k8s.io/api/apps/v1beta1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"time"
)

func setupDeploymentService(k8s *kubetest.K8SClientMock) DeploymentService {
	return DeploymentService{k8s: k8s}
}

func TestDeploymentListHandler(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetDeployments", mock.AnythingOfType("string")).Return(fakeDeploymentList(), nil)
	svc := setupDeploymentService(k8s)

	services, _ := svc.GetDeploymentList("Namespace")

	assert.Equal(3, len(services))
	assert.Equal("httpbin-v1", services[0].Name)
	assert.Equal(int32(1), services[0].Replicas)
	assert.Equal(int32(1), services[0].AvailableReplicas)
	assert.Equal(int32(0), services[0].UnavailableReplicas)

	assert.Equal("httpbin-v2", services[1].Name)
	assert.Equal(int32(2), services[1].Replicas)
	assert.Equal(int32(1), services[1].AvailableReplicas)
	assert.Equal(int32(1), services[1].UnavailableReplicas)

	assert.Equal("httpbin-v3", services[2].Name)
	assert.Equal(int32(2), services[2].Replicas)
	assert.Equal(int32(0), services[2].AvailableReplicas)
	assert.Equal(int32(2), services[2].UnavailableReplicas)
}

func fakeDeploymentList() *v1beta1.DeploymentList {
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	return &v1beta1.DeploymentList{
		Items: []v1beta1.Deployment{
			{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:              "httpbin-v1",
					CreationTimestamp: meta_v1.NewTime(t1),
					Labels:            map[string]string{"app": "httpbin", "version": "v1"}},
				Status: v1beta1.DeploymentStatus{
					Replicas:            1,
					AvailableReplicas:   1,
					UnavailableReplicas: 0,
				},
			},
			{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:              "httpbin-v2",
					CreationTimestamp: meta_v1.NewTime(t1),
					Labels:            map[string]string{"app": "httpbin", "version": "v2"}},
				Status: v1beta1.DeploymentStatus{
					Replicas:            2,
					AvailableReplicas:   1,
					UnavailableReplicas: 1,
				},
			},
			{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:              "httpbin-v3",
					CreationTimestamp: meta_v1.NewTime(t1),
					Labels:            map[string]string{"app": "httpbin", "version": "v3"}},
				Status: v1beta1.DeploymentStatus{
					Replicas:            2,
					AvailableReplicas:   0,
					UnavailableReplicas: 2,
				},
			},
		},
	}
}
