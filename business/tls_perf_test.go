package business

import (
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"
	security_v1beta1 "istio.io/client-go/pkg/apis/security/v1beta1"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/config"
)

func TestTlsPerfSmall(t *testing.T) {



	ps := fakeStrictPeerAuthn("default", "bookinfo")
	drs := []networking_v1alpha3.DestinationRule{
		*data.CreateEmptyDestinationRule("bookinfo", "dr-1", "*.bookinfo.svc.cluster.local"),
	}

	nss := []core_v1.Namespace{}

	testPerfScenario(MTLSPartiallyEnabled, nss, drs, ps, false, t)
	testPerfScenario(MTLSEnabled, nss, drs, ps, true, t)
	testPerfScenario(MTLSEnabled, nss, []networking_v1alpha3.DestinationRule{}, ps, true, t)

}

func testPerfScenario(exStatus string, nss []core_v1.Namespace, drs []networking_v1alpha3.DestinationRule, ps []security_v1beta1.PeerAuthentication, autoMtls bool, t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	k8s := new(kubetest.K8SClientMock)
	fakeIstioObjects := []runtime.Object{}
	for _, d := range drs {
		fakeIstioObjects = append(fakeIstioObjects, &d)
	}
	for _, p := range ps {
		fakeIstioObjects = append(fakeIstioObjects, &p)
	}
	k8s.MockIstio(fakeIstioObjects...)
	k8s.On("IsOpenShift").Return(false)
	k8s.On("IsMaistraApi").Return(false)
	k8s.On("GetNamespaces").Return(nss, nil)
	for _, ns := range nss {
		k8s.On("GetNamespace", ns.Name).Return(&ns, nil)
	}
	config.Set(config.NewConfig())

	tlsService := TLSService{k8s: k8s, enabledAutoMtls: &autoMtls, businessLayer: NewWithBackends(k8s, nil, nil)}
	tlsService.businessLayer.Namespace.isAccessibleNamespaces["**"] = true
	status, err := (tlsService).NamespaceWidemTLSStatus("bookinfo")

	assert.NoError(err)
	assert.Equal(exStatus, status.Status)
}
