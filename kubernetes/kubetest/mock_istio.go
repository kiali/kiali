package kubetest

import (
	"context"

	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	istio "istio.io/client-go/pkg/clientset/versioned"
	istio_fake "istio.io/client-go/pkg/clientset/versioned/fake"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	gatewayapiclient "sigs.k8s.io/gateway-api/pkg/client/clientset/versioned"
	gatewayapifake "sigs.k8s.io/gateway-api/pkg/client/clientset/versioned/fake"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
)

func (o *K8SClientMock) MockIstio(objects ...runtime.Object) {
	o.istioClientset = istio_fake.NewSimpleClientset(objects...)
	// Istio Fake client has a problem with Gateways
	// Invoking a NewSimpleClientset() stores a wrong "gatewais" entry, that logic is not even the istio.io but
	// in the k8s.io/apimachinery, so the workaround is to invoke "Create" for those objects with problems
	for _, ob := range objects {
		if gw, ok := ob.(*networking_v1.Gateway); ok {
			_, err := o.istioClientset.NetworkingV1().Gateways(gw.Namespace).Create(context.TODO(), gw, v1.CreateOptions{})
			if err != nil {
				log.Errorf("Error initializing Gateways in MockIstio: %s", err)
			}
		}
	}
}

func (o *K8SClientMock) MockGatewayApi(objects ...runtime.Object) {
	o.gatewayapiClientSet = gatewayapifake.NewSimpleClientset(objects...)
}

func (o *K8SClientMock) Istio() istio.Interface {
	return o.istioClientset
}

func (o *K8SClientMock) GatewayAPI() gatewayapiclient.Interface {
	return o.gatewayapiClientSet
}

func (o *K8SClientMock) CanConnectToIstiod() (kubernetes.IstioComponentStatus, error) {
	args := o.Called()
	return args.Get(0).(kubernetes.IstioComponentStatus), args.Error(1)
}

func (o *K8SClientMock) GetProxyStatus() ([]*kubernetes.ProxyStatus, error) {
	args := o.Called()
	return args.Get(0).([]*kubernetes.ProxyStatus), args.Error(1)
}

func (o *K8SClientMock) GetConfigDump(namespace string, podName string) (*kubernetes.ConfigDump, error) {
	args := o.Called(namespace, podName)
	return args.Get(0).(*kubernetes.ConfigDump), args.Error(1)
}

func (o *K8SClientMock) GetRegistryServices() ([]*kubernetes.RegistryService, error) {
	args := o.Called()
	return args.Get(0).([]*kubernetes.RegistryService), args.Error(1)
}

func (o *K8SClientMock) SetProxyLogLevel(namespace, podName, level string) error {
	args := o.Called()
	return args.Error(0)
}
