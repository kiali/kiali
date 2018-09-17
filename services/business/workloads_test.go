package business

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"k8s.io/api/apps/v1beta1"
	"k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

func setupDeploymentService(k8s *kubetest.K8SClientMock) WorkloadService {
	return WorkloadService{k8s: k8s}
}

func TestDeploymentListHandler(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetDeployments", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(fakeDeploymentList(), nil)
	k8s.On("GetPods", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(fakePodList(), nil)
	svc := setupDeploymentService(k8s)

	workloadList, _ := svc.GetWorkloadList("Namespace")
	workloads := workloadList.Workloads

	assert.Equal("Namespace", workloadList.Namespace.Name)

	assert.Equal(3, len(workloads))
	assert.Equal("httpbin-v1", workloads[0].Name)
	assert.Equal(true, workloads[0].AppLabel)
	assert.Equal(false, workloads[0].VersionLabel)
	assert.Equal("httpbin-v2", workloads[1].Name)
	assert.Equal(true, workloads[1].AppLabel)
	assert.Equal(true, workloads[1].VersionLabel)
	assert.Equal("httpbin-v3", workloads[2].Name)
	assert.Equal(false, workloads[2].AppLabel)
	assert.Equal(false, workloads[2].VersionLabel)
}

func TestGetPods(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetPods", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(fakePodList(), nil)

	svc := setupDeploymentService(k8s)

	pods, _ := svc.GetPods("Namespace", "app=httpbin")

	assert.Equal(1, len(pods))
	assert.Equal("details-v1-3618568057-dnkjp", pods[0].Name)
}

func fakeDeploymentList() []v1beta1.Deployment {
	conf := config.NewConfig()
	config.Set(conf)
	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	return []v1beta1.Deployment{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "httpbin-v1",
				CreationTimestamp: meta_v1.NewTime(t1),
				Labels:            map[string]string{appLabel: "httpbin", versionLabel: "v1"},
			},
			Spec: v1beta1.DeploymentSpec{
				Selector: &meta_v1.LabelSelector{
					MatchLabels: map[string]string{appLabel: "httpbin", versionLabel: "v1"},
				},
				Template: v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{appLabel: "httpbin"},
					},
				},
			},
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
				Labels:            map[string]string{appLabel: "httpbin", versionLabel: "v2"},
			},
			Spec: v1beta1.DeploymentSpec{
				Selector: &meta_v1.LabelSelector{
					MatchLabels: map[string]string{appLabel: "httpbin", versionLabel: "v2"},
				},
				Template: v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{appLabel: "httpbin", versionLabel: "v2"},
					},
				},
			},
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
				Labels:            map[string]string{appLabel: "httpbin", versionLabel: "v3"},
			},
			Spec: v1beta1.DeploymentSpec{
				Selector: &meta_v1.LabelSelector{
					MatchLabels: map[string]string{appLabel: "httpbin", versionLabel: "v3"},
				},
			},
			Status: v1beta1.DeploymentStatus{
				Replicas:            2,
				AvailableReplicas:   0,
				UnavailableReplicas: 2,
			},
		},
	}
}

func fakePodList() []v1.Pod {
	conf := config.NewConfig()
	config.Set(conf)
	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	return []v1.Pod{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "details-v1-3618568057-dnkjp",
				CreationTimestamp: meta_v1.NewTime(t1),
				Labels:            map[string]string{appLabel: "httpbin", versionLabel: "v1"},
				OwnerReferences: []meta_v1.OwnerReference{meta_v1.OwnerReference{
					Kind: "ReplicaSet",
					Name: "details-v1-3618568057",
				}},
				Annotations: map[string]string{"sidecar.istio.io/status": "{\"version\":\"\",\"initContainers\":[\"istio-init\",\"enable-core-dump\"],\"containers\":[\"istio-proxy\"],\"volumes\":[\"istio-envoy\",\"istio-certs\"]}"}},
			Spec: v1.PodSpec{
				Containers: []v1.Container{
					v1.Container{Name: "details", Image: "whatever"},
					v1.Container{Name: "istio-proxy", Image: "docker.io/istio/proxy:0.7.1"},
				},
				InitContainers: []v1.Container{
					v1.Container{Name: "istio-init", Image: "docker.io/istio/proxy_init:0.7.1"},
					v1.Container{Name: "enable-core-dump", Image: "alpine"},
				},
			},
		},
	}
}

func fakeServices() []v1.Service {
	return []v1.Service{
		{
			ObjectMeta: meta_v1.ObjectMeta{Name: "httpbin"},
		},
	}
}
