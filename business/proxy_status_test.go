package business

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

func TestGetWorkloadProxyStatusWithoutError(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	k8s := new(kubetest.K8SClientMock)
	conf := config.NewConfig()
	config.Set(conf)

	workload := "reviews-v1-982hashydas-212"
	namespace := "bookinfo"

	k8s.On("GetProxyStatus").Return([]*kubernetes.ProxyStatus{
		{SyncStatus: kubernetes.SyncStatus{
			ProxyID:       fmt.Sprintf("%s.%s", workload, namespace),
			ProxyVersion:  "1.7.1",
			IstioVersion:  "1.7.1",
			ClusterSent:   "zI1yscSI0RY=e9dbc143-4e20-44ec-aa5e-3c0b8097f21a",
			ClusterAcked:  "zI1yscSI0RY=e9dbc143-4e20-44ec-aa5e-3c0b8097f21a",
			ListenerSent:  "zI1yscSI0RY=e9dbc143-4e20-44ec-aa5e-3c0b8097f21a",
			ListenerAcked: "zI1yscSI0RY=e9dbc143-4e20-44ec-aa5e-3c0b8097f21a",
			RouteSent:     "zI1yscSI0RY=e9dbc143-4e20-44ec-aa5e-3c0b8097f21a",
			RouteAcked:    "zI1yscSI0RY=e9dbc143-4e20-44ec-aa5e-3c0b8097f21a",
			EndpointSent:  "zI1yscSI0RY=e9dbc143-4e20-44ec-aa5e-3c0b8097f21a",
			EndpointAcked: "zI1yscSI0RY=e9dbc143-4e20-44ec-aa5e-3c0b8097f21a",
		}},
	}, nil)

	layer := ProxyStatus{k8s: k8s}
	proxiesSynced, err := layer.GetWorkloadProxyStatus(workload, namespace)

	assert.Equal(int32(1), proxiesSynced)
	assert.NoError(err)
}

func TestGetWorkloadProxyStatusWithError(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	k8s := new(kubetest.K8SClientMock)
	conf := config.NewConfig()
	config.Set(conf)

	workload := "reviews-v1-982hashydas-212"
	namespace := "bookinfo"

	k8s.On("GetProxyStatus").Return([]*kubernetes.ProxyStatus{
		{SyncStatus: kubernetes.SyncStatus{
			ProxyID:       fmt.Sprintf("%s.%s", workload, namespace),
			ProxyVersion:  "1.7.1",
			IstioVersion:  "1.7.1",
			ClusterSent:   "clusterdifferent",
			ClusterAcked:  "clusterequals",
			ListenerSent:  "zI1yscSI0RY=e9dbc143-4e20-44ec-aa5e-3c0b8097f21a",
			ListenerAcked: "zI1yscSI0RY=e9dbc143-4e20-44ec-aa5e-3c0b8097f21a",
			RouteSent:     "routedifferent",
			RouteAcked:    "",
			EndpointSent:  "zI1yscSI0RY=e9dbc143-4e20-44ec-aa5e-3c0b8097f21a",
			EndpointAcked: "zI1yscSI0RY=e9dbc143-4e20-44ec-aa5e-3c0b8097f21a",
		}},
	}, nil)

	layer := ProxyStatus{k8s: k8s}
	proxiesSynced, err := layer.GetWorkloadProxyStatus(workload, namespace)

	assert.NoError(err)
	assert.Zero(proxiesSynced)
}

func TestGetWorkloadsProxyStatus(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	k8s := new(kubetest.K8SClientMock)
	conf := config.NewConfig()
	config.Set(conf)

	namespace := "bookinfo"

	k8s.On("GetProxyStatus").Return([]*kubernetes.ProxyStatus{
		{SyncStatus: kubernetes.SyncStatus{
			ProxyID:       fmt.Sprintf("reviews-v1-982hashydas-212.%s", namespace),
			ProxyVersion:  "1.7.1",
			IstioVersion:  "1.7.1",
			ClusterSent:   "clusterdifferent",
			ClusterAcked:  "clusterequals",
			ListenerSent:  "zI1yscSI0RY=e9dbc143-4e20-44ec-aa5e-3c0b8097f21a",
			ListenerAcked: "zI1yscSI0RY=e9dbc143-4e20-44ec-aa5e-3c0b8097f21a",
			RouteSent:     "routedifferent",
			RouteAcked:    "",
			EndpointSent:  "zI1yscSI0RY=e9dbc143-4e20-44ec-aa5e-3c0b8097f21a",
			EndpointAcked: "zI1yscSI0RY=e9dbc143-4e20-44ec-aa5e-3c0b8097f21a",
		}},
		{SyncStatus: kubernetes.SyncStatus{
			ProxyID:       fmt.Sprintf("reviews-v2-982hashydas-212.%s", namespace),
			ProxyVersion:  "1.7.1",
			IstioVersion:  "1.7.1",
			ClusterSent:   "zI1yscSI0RY=e9dbc143-4e20-44ec-aa5e-3c0b8097f21a",
			ClusterAcked:  "zI1yscSI0RY=e9dbc143-4e20-44ec-aa5e-3c0b8097f21a",
			ListenerSent:  "zI1yscSI0RY=e9dbc143-4e20-44ec-aa5e-3c0b8097f21a",
			ListenerAcked: "zI1yscSI0RY=e9dbc143-4e20-44ec-aa5e-3c0b8097f21a",
			RouteSent:     "zI1yscSI0RY=e9dbc143-4e20-44ec-aa5e-3c0b8097f21a",
			RouteAcked:    "zI1yscSI0RY=e9dbc143-4e20-44ec-aa5e-3c0b8097f21a",
			EndpointSent:  "zI1yscSI0RY=e9dbc143-4e20-44ec-aa5e-3c0b8097f21a",
			EndpointAcked: "zI1yscSI0RY=e9dbc143-4e20-44ec-aa5e-3c0b8097f21a",
		}},
	}, nil)

	layer := ProxyStatus{k8s: k8s}
	proxiesSynced, err := layer.GetWorkloadsProxyStatus(namespace, fakeMultipleWorkloadStatus())

	assert.NoError(err)
	assert.Equal(int32(0), proxiesSynced["reviews-v1-982hashydas-212"])
	assert.Equal(int32(1), proxiesSynced["reviews-v2-982hashydas-212"])
}

func fakeMultipleWorkloadStatus() []string {
	return []string{"reviews-v1-982hashydas-212", "reviews-v2-982hashydas-212"}
}
