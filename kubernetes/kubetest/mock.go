package kubetest

import (
	"time"

	"github.com/stretchr/testify/mock"
	"k8s.io/api/apps/v1beta1"
	"k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
)

type K8SClientMock struct {
	mock.Mock
}

func (o *K8SClientMock) GetNamespaces() (*v1.NamespaceList, error) {
	args := o.Called()
	return args.Get(0).(*v1.NamespaceList), args.Error(1)
}

func (o *K8SClientMock) GetDeployment(namespace string, deploymentName string) (*v1beta1.Deployment, error) {
	args := o.Called(namespace, deploymentName)
	return args.Get(0).(*v1beta1.Deployment), args.Error(1)
}

func (o *K8SClientMock) GetDeployments(namespace string, labelSelector string) (*v1beta1.DeploymentList, error) {
	args := o.Called(namespace, labelSelector)
	return args.Get(0).(*v1beta1.DeploymentList), args.Error(1)
}

func (o *K8SClientMock) GetService(namespace string, serviceName string) (*v1.Service, error) {
	args := o.Called(namespace, serviceName)
	return args.Get(0).(*v1.Service), args.Error(1)
}

func (o *K8SClientMock) GetNamespaceAppsDetails(namespace string) (kubernetes.NamespaceApps, error) {
	args := o.Called(namespace)
	return args.Get(0).(kubernetes.NamespaceApps), args.Error(1)
}

func (o *K8SClientMock) GetAppDetails(namespace, app string) (kubernetes.AppDetails, error) {
	args := o.Called(namespace, app)
	return args.Get(0).(kubernetes.AppDetails), args.Error(1)
}

func (o *K8SClientMock) GetServices(namespace string, selectorLabels map[string]string) (*v1.ServiceList, error) {
	args := o.Called(namespace, selectorLabels)
	return args.Get(0).(*v1.ServiceList), args.Error(1)
}

func (o *K8SClientMock) GetDeploymentDetails(namespace string, deploymentName string) (*kubernetes.DeploymentDetails, error) {
	args := o.Called(namespace)
	return args.Get(0).(*kubernetes.DeploymentDetails), args.Error(1)
}

func (o *K8SClientMock) GetPods(namespace, labelSelector string) (*v1.PodList, error) {
	args := o.Called(namespace, labelSelector)
	return args.Get(0).(*v1.PodList), args.Error(1)
}

func (o *K8SClientMock) GetEndpoints(namespace string, serviceName string) (*v1.Endpoints, error) {
	args := o.Called(namespace, serviceName)
	return args.Get(0).(*v1.Endpoints), args.Error(1)
}

func (o *K8SClientMock) GetServicePods(namespace string, serviceName string, serviceVersion string) (*v1.PodList, error) {
	args := o.Called(namespace, serviceName, serviceVersion)
	return args.Get(0).(*v1.PodList), args.Error(1)
}

func (o *K8SClientMock) GetServicesByDeploymentSelector(namespace string, deployment *v1beta1.Deployment) (*v1.ServiceList, error) {
	args := o.Called(namespace, deployment)
	return args.Get(0).(*v1.ServiceList), args.Error(1)
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

func (o *K8SClientMock) FakeService() *v1.Service {
	return &v1.Service{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "httpbin",
			Namespace: "tutorial",
			Labels: map[string]string{
				"app":     "httpbin",
				"version": "v1"}},
		Spec: v1.ServiceSpec{
			ClusterIP: "fromservice",
			Type:      "ClusterIP",
			Selector:  map[string]string{"app": "httpbin"},
			Ports: []v1.ServicePort{
				{
					Name:     "http",
					Protocol: "TCP",
					Port:     3001},
				{
					Name:     "http",
					Protocol: "TCP",
					Port:     3000}}}}
}

func (o *K8SClientMock) FakeServiceDetails() *kubernetes.ServiceDetails {
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")

	return &kubernetes.ServiceDetails{
		Service: &v1.Service{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "httpbin",
				Namespace: "tutorial",
				Labels: map[string]string{
					"app":     "httpbin",
					"version": "v1"}},
			Spec: v1.ServiceSpec{
				ClusterIP: "fromservice",
				Type:      "ClusterIP",
				Selector:  map[string]string{"app": "httpbin"},
				Ports: []v1.ServicePort{
					{
						Name:     "http",
						Protocol: "TCP",
						Port:     3001},
					{
						Name:     "http",
						Protocol: "TCP",
						Port:     3000}}}},
		Deployments: &v1beta1.DeploymentList{
			Items: []v1beta1.Deployment{
				v1beta1.Deployment{
					ObjectMeta: meta_v1.ObjectMeta{
						Name:              "httpbin-v1",
						CreationTimestamp: meta_v1.NewTime(t1),
						Labels:            map[string]string{"app": "httpbin", "version": "v1"}},
					Status: v1beta1.DeploymentStatus{
						Replicas:            1,
						AvailableReplicas:   1,
						UnavailableReplicas: 0}}}}}
}

func (o *K8SClientMock) FakeServiceList() *v1.ServiceList {
	return &v1.ServiceList{
		Items: []v1.Service{
			{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:      "reviews",
					Namespace: "tutorial",
					Labels: map[string]string{
						"app":     "reviews",
						"version": "v1"}},
				Spec: v1.ServiceSpec{
					ClusterIP: "fromservice",
					Type:      "ClusterIP",
					Selector:  map[string]string{"app": "reviews"},
					Ports: []v1.ServicePort{
						{
							Name:     "http",
							Protocol: "TCP",
							Port:     3001},
						{
							Name:     "http",
							Protocol: "TCP",
							Port:     3000}}}},
			{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:      "httpbin",
					Namespace: "tutorial",
					Labels: map[string]string{
						"app":     "httpbin",
						"version": "v1"}},
				Spec: v1.ServiceSpec{
					ClusterIP: "fromservice",
					Type:      "ClusterIP",
					Selector:  map[string]string{"app": "httpbin"},
					Ports: []v1.ServicePort{
						{
							Name:     "http",
							Protocol: "TCP",
							Port:     3001},
						{
							Name:     "http",
							Protocol: "TCP",
							Port:     3000}}}},
		},
	}
}

func (o *K8SClientMock) FakePodList() *v1.PodList {
	return &v1.PodList{
		Items: []v1.Pod{
			{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:   "reviews-v1",
					Labels: map[string]string{"app": "reviews", "version": "v1"}}},
			{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:   "reviews-v2",
					Labels: map[string]string{"app": "reviews", "version": "v2"}}},
			{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:   "httpbin-v1",
					Labels: map[string]string{"app": "httpbin", "version": "v1"}}},
		},
	}
}

func (o *K8SClientMock) FakeNamespaceApps() kubernetes.NamespaceApps {
	ret := make(kubernetes.NamespaceApps)
	ret["reviews"] = &kubernetes.AppDetails{
		Services: []v1.Service{
			v1.Service{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:      "reviews",
					Namespace: "tutorial",
					Labels: map[string]string{
						"app":     "reviews",
						"version": "v1"}},
				Spec: v1.ServiceSpec{
					ClusterIP: "fromservice",
					Type:      "ClusterIP",
					Selector:  map[string]string{"app": "reviews"},
					Ports: []v1.ServicePort{
						{
							Name:     "http",
							Protocol: "TCP",
							Port:     3001},
						{
							Name:     "http",
							Protocol: "TCP",
							Port:     3000}}}}},
		Pods: []v1.Pod{
			v1.Pod{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:   "reviews-v1",
					Labels: map[string]string{"app": "reviews", "version": "v1"}}},
			v1.Pod{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:   "reviews-v2",
					Labels: map[string]string{"app": "reviews", "version": "v2"}}}},
		Deployments: []v1beta1.Deployment{
			v1beta1.Deployment{
				ObjectMeta: meta_v1.ObjectMeta{
					Name: "reviews-v1"},
				Status: v1beta1.DeploymentStatus{
					Replicas:            3,
					AvailableReplicas:   2,
					UnavailableReplicas: 1},
				Spec: v1beta1.DeploymentSpec{
					Selector: &meta_v1.LabelSelector{
						MatchLabels: map[string]string{"app": "reviews", "version": "v1"}}}},
			v1beta1.Deployment{
				ObjectMeta: meta_v1.ObjectMeta{
					Name: "reviews-v2"},
				Status: v1beta1.DeploymentStatus{
					Replicas:            2,
					AvailableReplicas:   1,
					UnavailableReplicas: 1},
				Spec: v1beta1.DeploymentSpec{
					Selector: &meta_v1.LabelSelector{
						MatchLabels: map[string]string{"app": "reviews", "version": "v2"}}}}},
	}
	ret["httpbin"] = &kubernetes.AppDetails{
		Services: []v1.Service{
			v1.Service{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:      "httpbin",
					Namespace: "tutorial",
					Labels: map[string]string{
						"app":     "httpbin",
						"version": "v1"}},
				Spec: v1.ServiceSpec{
					ClusterIP: "fromservice",
					Type:      "ClusterIP",
					Selector:  map[string]string{"app": "httpbin"},
					Ports: []v1.ServicePort{
						{
							Name:     "http",
							Protocol: "TCP",
							Port:     3001},
						{
							Name:     "http",
							Protocol: "TCP",
							Port:     3000}}}}},
		Pods: []v1.Pod{
			v1.Pod{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:   "httpbin-v1",
					Labels: map[string]string{"app": "httpbin", "version": "v1"}}}},
		Deployments: []v1beta1.Deployment{
			v1beta1.Deployment{
				ObjectMeta: meta_v1.ObjectMeta{
					Name: "httpbin-v1"},
				Status: v1beta1.DeploymentStatus{
					Replicas:            1,
					AvailableReplicas:   1,
					UnavailableReplicas: 0},
				Spec: v1beta1.DeploymentSpec{
					Selector: &meta_v1.LabelSelector{
						MatchLabels: map[string]string{"app": "httpbin", "version": "v1"}}}}},
	}
	return ret
}

func (o *K8SClientMock) FakeAppDetails() kubernetes.AppDetails {
	app, _ := o.FakeNamespaceApps()["reviews"]
	return *app
}
